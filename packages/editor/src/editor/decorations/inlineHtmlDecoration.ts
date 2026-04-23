import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'
import { resolveLinkHref } from './linkDecoration'

// Tags allowed to pass through the sanitizer
const ALLOWED_TAGS = new Set([
  'details',
  'summary',
  'div',
  'span',
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'video',
  'audio',
  'source',
  'track',
  'iframe',
])

const STRIP_CONTENT_TAGS = new Set(['script', 'style'])

const TAG_ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  video: new Set(['src', 'controls', 'width', 'height', 'poster', 'preload', 'loop', 'muted', 'autoplay', 'playsinline']),
  audio: new Set(['src', 'controls', 'preload', 'loop', 'muted', 'autoplay']),
  source: new Set(['src', 'type']),
  track: new Set(['kind', 'src', 'srclang', 'label', 'default']),
  iframe: new Set(['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'sandbox']),
}

const BOOLEAN_ATTRIBUTES = new Set([
  'controls',
  'loop',
  'muted',
  'autoplay',
  'playsinline',
  'allowfullscreen',
  'default',
])

const DEFAULT_IFRAME_SANDBOX = 'allow-scripts allow-presentation'
const SAFE_IFRAME_ALLOW_TOKENS = new Set([
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'picture-in-picture',
  'web-share',
])

const SAFE_STYLE_PROPERTIES = new Set([
  'background-color',
  'color',
  'display',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'vertical-align',
  'width',
])

const STYLE_DANGEROUS_VALUE_PATTERN = /\b(?:expression|url)\s*\(|@import\b|(?:java|vb)script:|data:|-moz-binding\b|behavior\s*:|[<>{}\\]/
const LENGTH_VALUE_PATTERN = /^(?:0|-?(?:\d+|\d*\.\d+)(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ex)?)$/i
const COLOR_VALUE_PATTERN = /^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)|currentcolor|transparent)$/i

function hasControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

function sanitizeUrl(value: string, allowedProtocols: ReadonlySet<string>) {
  const trimmed = value.trim()
  if (!trimmed || hasControlCharacters(trimmed)) {
    return null
  }

  const protocolMatch = trimmed.match(/^([a-zA-Z][\w+.-]*):/)
  if (!protocolMatch) {
    return trimmed
  }

  return allowedProtocols.has(protocolMatch[1].toLowerCase()) ? trimmed : null
}

function sanitizeDimension(value: string) {
  const trimmed = value.trim()
  return !hasControlCharacters(trimmed) && /^\d+(?:px|%)?$/.test(trimmed) ? trimmed : null
}

function sanitizePreload(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed === 'none' || trimmed === 'metadata' || trimmed === 'auto' ? trimmed : null
}

function sanitizeTrackKind(value: string) {
  const trimmed = value.trim().toLowerCase()
  return ['subtitles', 'captions', 'descriptions', 'chapters', 'metadata'].includes(trimmed)
    ? trimmed
    : null
}

function sanitizeTrackLanguage(value: string) {
  const trimmed = value.trim()
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null
}

function sanitizeMimeType(value: string) {
  const trimmed = value.trim()
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(trimmed) ? trimmed : null
}

function sanitizeIframeAllow(value: string) {
  const tokens = value
    .split(/[;,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => SAFE_IFRAME_ALLOW_TOKENS.has(token))

  return tokens.length > 0 ? Array.from(new Set(tokens)).join('; ') : null
}

function sanitizeIframeSandbox(value: string | null) {
  if (!value) {
    return DEFAULT_IFRAME_SANDBOX
  }

  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token === 'allow-scripts' || token === 'allow-presentation')

  return tokens.length > 0 ? Array.from(new Set(tokens)).join(' ') : DEFAULT_IFRAME_SANDBOX
}

function isSafeStyleValue(value: string) {
  const normalized = value.toLowerCase()
  return (
    value.length <= 160 &&
    !hasControlCharacters(value) &&
    !STYLE_DANGEROUS_VALUE_PATTERN.test(normalized) &&
    !normalized.includes('/*') &&
    !normalized.includes('*/')
  )
}

function isLengthValue(value: string, allowAuto = false) {
  const trimmed = value.trim().toLowerCase()
  return (allowAuto && trimmed === 'auto') || LENGTH_VALUE_PATTERN.test(trimmed)
}

function isLengthListValue(value: string, allowAuto = false) {
  const parts = value.trim().split(/\s+/)
  return parts.length >= 1 && parts.length <= 4 && parts.every((part) => isLengthValue(part, allowAuto))
}

function sanitizeStyleValue(property: string, value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  const normalized = trimmed.toLowerCase()
  if (!trimmed || !isSafeStyleValue(trimmed)) {
    return null
  }

  if (property === 'color' || property === 'background-color') {
    return COLOR_VALUE_PATTERN.test(trimmed) ? trimmed : null
  }

  if (
    property === 'width' ||
    property === 'height' ||
    property === 'min-width' ||
    property === 'min-height' ||
    property === 'max-width' ||
    property === 'max-height'
  ) {
    return isLengthValue(trimmed, property === 'width' || property === 'height') ? trimmed : null
  }

  if (property.startsWith('margin')) {
    return isLengthListValue(trimmed, true) ? trimmed : null
  }

  if (property.startsWith('padding')) {
    return isLengthListValue(trimmed) ? trimmed : null
  }

  if (property === 'font-size') {
    return isLengthValue(trimmed) ? trimmed : null
  }

  if (property === 'font-weight') {
    return /^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(normalized) ? trimmed : null
  }

  if (property === 'font-style') {
    return /^(?:normal|italic|oblique)$/.test(normalized) ? trimmed : null
  }

  if (property === 'line-height') {
    return normalized === 'normal' || /^(?:\d+|\d*\.\d+)$/.test(normalized) || isLengthValue(trimmed)
      ? trimmed
      : null
  }

  if (property === 'text-align') {
    return /^(?:left|right|center|justify|start|end)$/.test(normalized) ? trimmed : null
  }

  if (property === 'text-decoration') {
    return /^(?:none|underline|overline|line-through)(?:\s+(?:solid|double|dotted|dashed|wavy))?$/.test(normalized)
      ? trimmed
      : null
  }

  if (property === 'display') {
    return /^(?:inline|inline-block|block|none)$/.test(normalized) ? trimmed : null
  }

  if (property === 'vertical-align') {
    return /^(?:baseline|sub|super|text-top|text-bottom|middle|top|bottom)$/.test(normalized) ||
      isLengthValue(trimmed)
      ? trimmed
      : null
  }

  return null
}

function sanitizeInlineStyle(value: string) {
  if (hasControlCharacters(value)) {
    return null
  }

  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)

  const sanitized = declarations
    .map((declaration) => {
      const separator = declaration.indexOf(':')
      if (separator <= 0) {
        return null
      }

      const property = declaration.slice(0, separator).trim().toLowerCase()
      if (!SAFE_STYLE_PROPERTIES.has(property)) {
        return null
      }

      const sanitizedValue = sanitizeStyleValue(property, declaration.slice(separator + 1))
      return sanitizedValue ? `${property}: ${sanitizedValue}` : null
    })
    .filter((declaration): declaration is string => declaration !== null)

  return sanitized.length > 0 ? sanitized.join('; ') : null
}

function resolveMediaUrlAttribute(attrValue: string, filePath?: string) {
  const sanitized = sanitizeUrl(attrValue, new Set(['http', 'https', 'file', 'blob']))
  if (!sanitized || sanitized.startsWith('//')) {
    return null
  }

  return resolveLinkHref(sanitized, filePath)
}

function sanitizeAttribute(tagName: string, attrName: string, attrValue: string, filePath?: string) {
  if (attrName.startsWith('on')) {
    return null
  }

  if (attrName === 'style') {
    const sanitized = sanitizeInlineStyle(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  const allowedAttributes = TAG_ALLOWED_ATTRIBUTES[tagName]
  if (!allowedAttributes?.has(attrName)) {
    return null
  }

  if (BOOLEAN_ATTRIBUTES.has(attrName)) {
    return { name: attrName, value: '' }
  }

  if (attrName === 'src') {
    const sanitized =
      tagName === 'iframe'
        ? sanitizeUrl(attrValue, new Set(['http', 'https']))
        : resolveMediaUrlAttribute(attrValue, filePath)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'poster') {
    const sanitized = resolveMediaUrlAttribute(attrValue, filePath)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'type') {
    const sanitized = sanitizeMimeType(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'width' || attrName === 'height') {
    const sanitized = sanitizeDimension(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'preload') {
    const sanitized = sanitizePreload(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'allow') {
    const sanitized = sanitizeIframeAllow(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'loading') {
    const sanitized = attrValue.trim().toLowerCase()
    return sanitized === 'lazy' || sanitized === 'eager'
      ? { name: attrName, value: sanitized }
      : null
  }

  if (attrName === 'sandbox') {
    return { name: attrName, value: sanitizeIframeSandbox(attrValue) }
  }

  if (attrName === 'title') {
    const sanitized = attrValue.trim()
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'kind') {
    const sanitized = sanitizeTrackKind(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'srclang') {
    const sanitized = sanitizeTrackLanguage(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'label') {
    const sanitized = attrValue.trim()
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  return null
}

function sanitizeHtml(html: string, filePath?: string): string {
  const template = document.createElement('template')
  template.innerHTML = html

  function sanitizeNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tagName)) {
        if (STRIP_CONTENT_TAGS.has(tagName)) {
          el.remove()
          return
        }
        // Replace disallowed element with its text content
        const text = document.createTextNode(el.textContent ?? '')
        el.replaceWith(text)
        return
      }

      const nextAttributes = Array.from(el.attributes)
        .map((attr) => sanitizeAttribute(tagName, attr.name.toLowerCase(), attr.value, filePath))
        .filter((attr): attr is { name: string; value: string } => attr !== null)

      const attrNames = Array.from(el.attributes).map((a) => a.name)
      for (const attrName of attrNames) {
        el.removeAttribute(attrName)
      }

      for (const attr of nextAttributes) {
        el.setAttribute(attr.name, attr.value)
      }

      if (tagName === 'iframe' && !el.hasAttribute('sandbox')) {
        el.setAttribute('sandbox', DEFAULT_IFRAME_SANDBOX)
      }

      Array.from(el.childNodes).forEach(sanitizeNode)
    }
  }

  Array.from(template.content.childNodes).forEach(sanitizeNode)

  const div = document.createElement('div')
  div.appendChild(template.content.cloneNode(true))
  return div.innerHTML
}

class HtmlBlockWidget extends WidgetType {
  private readonly html: string
  private readonly isInline: boolean
  private readonly filePath?: string

  constructor(html: string, isInline: boolean, filePath?: string) {
    super()
    this.html = html
    this.isInline = isInline
    this.filePath = filePath
  }

  eq(other: HtmlBlockWidget) {
    return other.html === this.html && other.isInline === this.isInline && other.filePath === this.filePath
  }

  toDOM() {
    const container = document.createElement(this.isInline ? 'span' : 'div')
    container.className = this.isInline ? 'mf-html-inline' : 'mf-html-block'
    container.innerHTML = sanitizeHtml(this.html, this.filePath)
    return container
  }

  get estimatedHeight() {
    return this.isInline ? -1 : 24
  }
}

interface DecorationEntry {
  from: number
  to: number
  decoration: Decoration
  order: number
}

const HTML_LIKE_NODE_CONFIG: Record<
  string,
  {
    isInline: boolean
    includeEndBoundary: boolean
  }
> = {
  HTMLBlock: { isInline: false, includeEndBoundary: true },
  HTMLTag: { isInline: true, includeEndBoundary: true },
  CommentBlock: { isInline: false, includeEndBoundary: true },
  Comment: { isInline: true, includeEndBoundary: false },
  Entity: { isInline: true, includeEndBoundary: false },
}

function isCursorInsideNode(
  cursorHead: number,
  from: number,
  to: number,
  includeEndBoundary: boolean,
) {
  return cursorHead >= from && (includeEndBoundary ? cursorHead <= to : cursorHead < to)
}

function buildDecorations(view: EditorView, filePath?: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)
  const entries: DecorationEntry[] = []
  let order = 0

  const addDecoration = (from: number, to: number, decoration: Decoration) => {
    entries.push({ from, to, decoration, order: order++ })
  }

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      const { from, to } = node
      const nodeConfig = HTML_LIKE_NODE_CONFIG[node.name]
      if (nodeConfig) {
        const cursorInside = isCursorInsideNode(
          cursorHead,
          from,
          to,
          nodeConfig.includeEndBoundary,
        )

        if (!cursorInside) {
          const html = doc.sliceString(from, to)
          addDecoration(
            from,
            to,
            Decoration.replace({ widget: new HtmlBlockWidget(html, nodeConfig.isInline, filePath) }),
          )
        }
        return false
      }
    },
  })

  entries.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from
    }
    return left.order - right.order
  })

  for (const entry of entries) {
    builder.add(entry.from, entry.to, entry.decoration)
  }

  return builder.finish()
}

export function inlineHtmlDecorations(filePath?: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, filePath)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, filePath)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
