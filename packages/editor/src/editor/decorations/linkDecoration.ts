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

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
  ) {
    super()
  }

  toDOM() {
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.className = 'mf-image-widget'
    img.onerror = () => {
      const span = document.createElement('span')
      span.className = 'mf-image-error'
      span.textContent = `⚠ ${this.alt || 'Image not found'}`
      img.replaceWith(span)
    }
    return img
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt
  }
}

function hasProtocol(src: string) {
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(src)
}

function isAbsoluteFilePath(src: string) {
  return src.startsWith('/') || /^[A-Za-z]:[\\/]/.test(src)
}

function toFileUrl(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const absolutePath = /^[A-Za-z]:\//.test(normalizedPath)
    ? `/${normalizedPath}`
    : normalizedPath.startsWith('/')
      ? normalizedPath
      : `/${normalizedPath}`

  return new URL(encodeURI(absolutePath), 'file://').toString()
}

function stripEnclosingAngleBrackets(src: string) {
  return src.startsWith('<') && src.endsWith('>') ? src.slice(1, -1) : src
}

function normalizeBareUrlHref(src: string) {
  if (/^www\./i.test(src)) {
    return `https://${src}`
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(src) && !/^mailto:/i.test(src)) {
    return `mailto:${src}`
  }

  return src
}

export function resolveLinkHref(src: string, filePath?: string) {
  const trimmedSrc = stripEnclosingAngleBrackets(src.trim())
  if (!trimmedSrc || trimmedSrc.startsWith('//')) {
    return trimmedSrc
  }

  if (trimmedSrc.startsWith('#')) {
    return trimmedSrc
  }

  if (isAbsoluteFilePath(trimmedSrc)) {
    return toFileUrl(trimmedSrc)
  }

  if (hasProtocol(trimmedSrc)) {
    return trimmedSrc
  }

  if (!filePath) {
    return trimmedSrc
  }

  return new URL(trimmedSrc, new URL('.', toFileUrl(filePath))).toString()
}

export function resolveImageSource(src: string, filePath?: string) {
  return resolveLinkHref(src, filePath)
}

export function fileUrlToPath(href: string) {
  if (!href.startsWith('file://')) {
    return null
  }

  const url = new URL(href)
  const pathname = decodeURIComponent(url.pathname)
  return pathname.replace(/^\/([A-Za-z]:\/)/, '$1')
}

export function isMarkdownFilePath(filePath: string) {
  return /\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)
}

function normalizeReferenceLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isFootnoteReference(raw: string) {
  return /^\[\^([^\]\n]+)\]$/.test(raw)
}

function extractReferenceDefinitions(view: EditorView) {
  const references = new Map<string, string>()
  const doc = view.state.doc
  const cursor = syntaxTree(view.state).cursor()

  const visit = (parentName?: string) => {
    do {
      if (cursor.name === 'LinkReference' && parentName !== 'Link') {
        const raw = doc.sliceString(cursor.from, cursor.to)
        const match = raw.match(/^\[([^\]]+)\]:\s*(<[^>]+>|[^\s]+)(?:\s+["'(].*)?$/)
        if (match) {
          references.set(normalizeReferenceLabel(match[1]), match[2])
        }
      }

      if (cursor.firstChild()) {
        const currentName = cursor.name
        visit(currentName)
        cursor.parent()
      }
    } while (cursor.nextSibling())
  }

  visit()
  return references
}

function addRenderedLink(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  textLength: number,
  href: string | null,
) {
  const textFrom = from + 1
  const textTo = textFrom + textLength
  const textEnd = textTo + 1

  builder.add(from, from + 1, Decoration.replace({}))
  if (textFrom < textTo) {
    builder.add(
      textFrom,
      textTo,
      Decoration.mark({
        class: 'mf-link',
        tagName: href ? 'a' : 'span',
        attributes: href
          ? {
              href,
              target: '_blank',
              rel: 'noopener noreferrer',
            }
          : undefined,
      }),
    )
  }
  builder.add(textEnd, to, Decoration.replace({}))
}

function isReferenceDefinitionUrl(view: EditorView, from: number) {
  const line = view.state.doc.lineAt(from)
  const prefix = line.text.slice(0, from - line.from)
  return /^\[[^\]]+\]:\s*$/.test(prefix)
}

export function buildLinkDecorations(view: EditorView, filePath?: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const references = extractReferenceDefinitions(view)
  const cursor = syntaxTree(view.state).cursor()

  const visit = (insideStructuredLink = false) => {
    do {
      const { from, to } = cursor
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (cursor.name === 'Image') {
        if (!cursorInside) {
          const raw = doc.sliceString(from, to)
          const match = raw.match(/^!\[([^\]]*)\]\(([^)]*)\)/)
          if (match) {
            const [, alt, src] = match
            builder.add(
              from,
              to,
              Decoration.replace({ widget: new ImageWidget(resolveImageSource(src, filePath), alt) }),
            )
          }
        }
      } else if (cursor.name === 'Link') {
        const raw = doc.sliceString(from, to)
        if (isFootnoteReference(raw)) {
          continue
        }

        if (!cursorInside) {
          const inlineMatch = raw.match(/^\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+["'(].*)?\)$/)
          if (inlineMatch) {
            addRenderedLink(builder, from, to, inlineMatch[1].length, resolveLinkHref(inlineMatch[2], filePath))
          } else {
            const referenceMatch = raw.match(/^\[([^\]]*)\](?:\[([^\]]*)\])?$/)
            if (referenceMatch) {
              const label = referenceMatch[2] || referenceMatch[1]
              const href = references.get(normalizeReferenceLabel(label))
              addRenderedLink(builder, from, to, referenceMatch[1].length, href ? resolveLinkHref(href, filePath) : null)
            }
          }
        } else {
          builder.add(from, to, Decoration.mark({ class: 'mf-link' }))
        }
      } else if (cursor.name === 'Autolink' && !cursorInside) {
        const raw = doc.sliceString(from, to)
        const match = raw.match(/^<([^>]+)>$/)
        if (match) {
          builder.add(from, from + 1, Decoration.replace({}))
          builder.add(
            from + 1,
            to - 1,
            Decoration.mark({
              class: 'mf-link',
              tagName: 'a',
              attributes: {
                href: resolveLinkHref(normalizeBareUrlHref(match[1]), filePath),
                target: '_blank',
                rel: 'noopener noreferrer',
              },
            }),
          )
          builder.add(to - 1, to, Decoration.replace({}))
        }
      } else if (
        cursor.name === 'URL' &&
        !cursorInside &&
        !insideStructuredLink &&
        !isReferenceDefinitionUrl(view, from)
      ) {
        const raw = doc.sliceString(from, to)
        builder.add(
          from,
          to,
          Decoration.mark({
            class: 'mf-link',
            tagName: 'a',
            attributes: {
              href: resolveLinkHref(normalizeBareUrlHref(raw), filePath),
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          }),
        )
      }

      if (cursor.firstChild()) {
        const currentName = cursor.name
        visit(insideStructuredLink || ['Link', 'LinkReference', 'Autolink', 'Image'].includes(currentName))
        cursor.parent()
      }
    } while (cursor.nextSibling())
  }

  visit()
  return builder.finish()
}

export function linkDecorations(filePath?: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildLinkDecorations(view, filePath)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildLinkDecorations(update.view, filePath)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
