import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, RangeSet } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'

const IMAGE_WIDGET_ROOT_MARGIN = '256px 0px'
const imageWidgetCleanup = new WeakMap<HTMLElement, () => void>()

function applyImageSource(img: HTMLImageElement, src: string) {
  if (img.getAttribute('src') === src) {
    return
  }

  img.src = src
}

function attachLazyImageSource(img: HTMLImageElement, view: EditorView, src: string) {
  if (!src) {
    return
  }

  if (typeof IntersectionObserver !== 'function') {
    applyImageSource(img, src)
    return
  }

  let disposed = false
  const cleanup = () => {
    if (disposed) {
      return
    }

    disposed = true
    observer.unobserve(img)
    observer.disconnect()
    imageWidgetCleanup.delete(img)
  }
  // Start loading just before the image reaches the scroll viewport to reduce visible pop-in.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target !== img) {
          continue
        }

        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          applyImageSource(img, src)
          cleanup()
          return
        }
      }
    },
    {
      root: view.scrollDOM,
      rootMargin: IMAGE_WIDGET_ROOT_MARGIN,
    },
  )

  imageWidgetCleanup.set(img, cleanup)
  observer.observe(img)
}

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const img = document.createElement('img')
    img.alt = this.alt
    img.className = 'mf-image-widget'
    img.loading = 'lazy'
    img.decoding = 'async'
    img.onerror = () => {
      const span = document.createElement('span')
      span.className = 'mf-image-error'
      span.textContent = `⚠ ${this.alt || 'Image not found'}`
      img.replaceWith(span)
    }
    attachLazyImageSource(img, view, this.src)
    return img
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt
  }

  destroy(dom: HTMLElement) {
    imageWidgetCleanup.get(dom)?.()
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
  syntaxTree(view.state).iterate({
    from: 0,
    to: doc.length,
    enter(node) {
      if (node.name === 'LinkReference' && node.node.parent?.name !== 'Link') {
        const raw = doc.sliceString(node.from, node.to)
        const match = raw.match(/^\[([^\]]+)\]:\s*(<[^>]+>|[^\s]+)(?:\s+["'(].*)?$/)
        if (match) {
          references.set(normalizeReferenceLabel(match[1]), match[2])
        }
      }
    },
  })
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
  // Hide from end of link text (the `]` char) through the closing `)` — textEnd was off-by-one
  builder.add(textTo, to, Decoration.replace({}))
}

function isReferenceDefinitionUrl(view: EditorView, from: number) {
  const line = view.state.doc.lineAt(from)
  const prefix = line.text.slice(0, from - line.from)
  return /^\[[^\]]+\]:\s*$/.test(prefix)
}

function isInsideStructuredLink(node: { parent: { name: string; parent: unknown } | null }) {
  let current = node.parent
  while (current) {
    if (current.name === 'Link' || current.name === 'LinkReference' || current.name === 'Autolink' || current.name === 'Image') {
      return true
    }
    current = current.parent as { name: string; parent: unknown } | null
  }
  return false
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

class WikilinkWidget extends WidgetType {
  constructor(
    private filename: string,
    private displayText: string,
  ) {
    super()
  }

  toDOM(): HTMLElement {
    const href = this.filename.endsWith('.md') ? this.filename : `${this.filename}.md`
    const a = document.createElement('a')
    a.className = 'mf-wikilink'
    a.href = href
    a.dataset.wikilink = href
    a.textContent = this.displayText
    return a
  }

  eq(other: WikilinkWidget) {
    return this.filename === other.filename && this.displayText === other.displayText
  }

  ignoreEvent(): boolean {
    return false
  }
}

export function buildLinkDecorations(
  view: EditorView,
  filePath?: string,
  references: ReadonlyMap<string, string> = extractReferenceDefinitions(view),
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { from: minFrom, to: maxTo, startLine, endLine } = getDecorationViewportWindow(view)

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (node.name === 'Image') {
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
      } else if (node.name === 'Link') {
        const raw = doc.sliceString(from, to)
        if (isFootnoteReference(raw)) {
          return
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
      } else if (node.name === 'Autolink' && !cursorInside) {
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
        node.name === 'URL' &&
        !cursorInside &&
        !isInsideStructuredLink(node.node) &&
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
    },
  })

  // Wikilink decoration pass — scan raw text for [[...]] patterns
  const wikilinkBuilder = new RangeSetBuilder<Decoration>()
  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i)
    WIKILINK_RE.lastIndex = 0
    let wm: RegExpExecArray | null
    while ((wm = WIKILINK_RE.exec(line.text)) !== null) {
      const from = line.from + wm.index
      const to = from + wm[0].length
      const cursorInside = cursorHead >= from && cursorHead <= to
      if (!cursorInside) {
        const filename = wm[1].trim()
        const displayText = wm[2]?.trim() ?? filename
        wikilinkBuilder.add(
          from,
          to,
          Decoration.replace({ widget: new WikilinkWidget(filename, displayText) }),
        )
      }
    }
  }

  const wikilinkSet = wikilinkBuilder.finish()
  const linkSet = builder.finish()

  return RangeSet.join([linkSet, wikilinkSet])
}

export function linkDecorations(filePath?: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      references: Map<string, string>

      constructor(view: EditorView) {
        this.references = extractReferenceDefinitions(view)
        this.decorations = buildLinkDecorations(view, filePath, this.references)
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.references = extractReferenceDefinitions(update.view)
        }
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildLinkDecorations(update.view, filePath, this.references)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
