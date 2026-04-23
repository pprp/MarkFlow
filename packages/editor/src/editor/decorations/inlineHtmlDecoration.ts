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

const GLOBAL_ALLOWED_ATTRIBUTES = new Set(['style'])

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

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color',
  'color',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align',
  'text-decoration',
  'vertical-align',
])

const DISALLOWED_STYLE_VALUE = /(?:url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|[<>{}\\])/i
const CSS_COLOR_VALUE = /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\(\s*[\d.]+%?(?:\s*,\s*|\s+)[\d.]+%?(?:\s*,\s*|\s+)[\d.]+%?(?:\s*(?:,|\/)\s*(?:0|1|0?\.\d+|\d+%))?\s*\))$/i
const CSS_LENGTH_VALUE = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|pt|pc|in|cm|mm|q|ex|ch|%))$/i
const CSS_LINE_HEIGHT_VALUE = /^(?:normal|0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|pt|pc|in|cm|mm|q|ex|ch|%)?)$/i

function sanitizeUrl(value: string, allowedProtocols: ReadonlySet<string>) {
  const trimmed = value.trim()
  if (!trimmed) {
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
  return /^\d+(?:px|%)?$/.test(trimmed) ? trimmed : null
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

function hasAsciiControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function sanitizeStyleValue(property: string, value: string) {
  const sanitizedValue = value.trim().replace(/\s+/g, ' ')
  if (
    !sanitizedValue
    || DISALLOWED_STYLE_VALUE.test(sanitizedValue)
    || hasAsciiControlCharacter(sanitizedValue)
  ) {
    return null
  }

  switch (property) {
    case 'color':
    case 'background-color':
      return CSS_COLOR_VALUE.test(sanitizedValue) ? sanitizedValue : null
    case 'font-size':
      return CSS_LENGTH_VALUE.test(sanitizedValue)
        || ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'smaller', 'larger'].includes(sanitizedValue.toLowerCase())
        ? sanitizedValue
        : null
    case 'font-style':
      return ['normal', 'italic', 'oblique'].includes(sanitizedValue.toLowerCase())
        ? sanitizedValue.toLowerCase()
        : null
    case 'font-weight':
      return /^(?:normal|bold|bolder|lighter|[1-9]00)$/i.test(sanitizedValue)
        ? sanitizedValue.toLowerCase()
        : null
    case 'line-height':
      return CSS_LINE_HEIGHT_VALUE.test(sanitizedValue) ? sanitizedValue : null
    case 'text-align':
      return ['left', 'right', 'center', 'justify', 'start', 'end'].includes(sanitizedValue.toLowerCase())
        ? sanitizedValue.toLowerCase()
        : null
    case 'text-decoration': {
      const tokens = sanitizedValue.toLowerCase().split(/\s+/)
      return tokens.length > 0
        && tokens.every((token) => ['none', 'underline', 'overline', 'line-through'].includes(token))
        ? Array.from(new Set(tokens)).join(' ')
        : null
    }
    case 'vertical-align':
      return ['baseline', 'sub', 'super', 'text-top', 'text-bottom', 'middle', 'top', 'bottom'].includes(sanitizedValue.toLowerCase())
        || CSS_LENGTH_VALUE.test(sanitizedValue)
        ? sanitizedValue.toLowerCase()
        : null
    default:
      return null
  }
}

function sanitizeStyleAttribute(value: string) {
  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
  const sanitizedDeclarations: string[] = []

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':')
    if (separatorIndex <= 0) {
      continue
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const rawValue = declaration.slice(separatorIndex + 1)
    if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
      continue
    }

    const sanitizedValue = sanitizeStyleValue(property, rawValue)
    if (sanitizedValue) {
      sanitizedDeclarations.push(`${property}: ${sanitizedValue};`)
    }
  }

  return sanitizedDeclarations.length > 0 ? sanitizedDeclarations.join(' ') : null
}

function sanitizeAttribute(tagName: string, attrName: string, attrValue: string) {
  if (attrName.startsWith('on')) {
    return null
  }

  const allowedAttributes = TAG_ALLOWED_ATTRIBUTES[tagName]
  if (!allowedAttributes?.has(attrName) && !GLOBAL_ALLOWED_ATTRIBUTES.has(attrName)) {
    return null
  }

  if (attrName === 'style') {
    const sanitized = sanitizeStyleAttribute(attrValue)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (BOOLEAN_ATTRIBUTES.has(attrName)) {
    return { name: attrName, value: '' }
  }

  if (attrName === 'src') {
    const protocols = tagName === 'iframe'
      ? new Set(['http', 'https'])
      : new Set(['http', 'https', 'file', 'blob'])
    const sanitized = sanitizeUrl(attrValue, protocols)
    return sanitized ? { name: attrName, value: sanitized } : null
  }

  if (attrName === 'poster') {
    const sanitized = sanitizeUrl(attrValue, new Set(['http', 'https', 'file', 'blob']))
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

function sanitizeHtml(html: string): string {
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
        .map((attr) => sanitizeAttribute(tagName, attr.name.toLowerCase(), attr.value))
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

  constructor(html: string, isInline: boolean) {
    super()
    this.html = html
    this.isInline = isInline
  }

  eq(other: HtmlBlockWidget) {
    return other.html === this.html && other.isInline === this.isInline
  }

  toDOM() {
    const container = document.createElement(this.isInline ? 'span' : 'div')
    container.className = this.isInline ? 'mf-html-inline' : 'mf-html-block'
    container.innerHTML = sanitizeHtml(this.html)
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

function buildDecorations(view: EditorView): DecorationSet {
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
            Decoration.replace({ widget: new HtmlBlockWidget(html, nodeConfig.isInline) }),
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

export function inlineHtmlDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
