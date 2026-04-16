import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, RangeSet, Text } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'

const IMAGE_WIDGET_ROOT_MARGIN = '256px 0px'
const MIN_IMAGE_RESIZE_PX = 24
const imageWidgetCleanup = new WeakMap<HTMLElement, () => void>()
const IMAGE_MARKDOWN_RE = /^!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+["'(].*)?\)$/
const IMAGE_SIZE_TOKEN_RE = /\b(width|height)\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/gi
const IMAGE_SHORTHAND_SIZE_RE = /^(\s*)=(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i

type ImageResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

type ImageWidgetSource = {
  imageFrom: number
  imageTo: number
  replaceTo: number
  width?: number
  height?: number
}

type ParsedImageSize = {
  replaceTo: number
  width?: number
  height?: number
}

type ImageRenderSize = {
  width: number
  height: number
  aspectRatio: number
}

type ImageResizeSession = ImageRenderSize & {
  pointerId: number
  handle: ImageResizeHandle
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  didMove: boolean
}

const IMAGE_RESIZE_HANDLES: readonly ImageResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

function applyImageSource(img: HTMLImageElement, src: string) {
  if (img.getAttribute('src') === src) {
    return
  }

  img.src = src
}

function attachLazyImageSource(widgetRoot: HTMLElement, img: HTMLImageElement, view: EditorView, src: string) {
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
    imageWidgetCleanup.delete(widgetRoot)
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

  imageWidgetCleanup.set(widgetRoot, cleanup)
  observer.observe(img)
}

function parseImageDimension(raw?: string | number) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : undefined
  }

  if (!raw) {
    return undefined
  }

  const match = raw.match(/\d+(?:\.\d+)?/)
  if (!match) {
    return undefined
  }

  const value = Number.parseFloat(match[0])
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

function clampImageResizeDimension(value: number) {
  return Math.max(MIN_IMAGE_RESIZE_PX, parseImageDimension(value) ?? MIN_IMAGE_RESIZE_PX)
}

function parseBraceImageSize(body: string) {
  let width: number | undefined
  let height: number | undefined
  let matchedAny = false

  IMAGE_SIZE_TOKEN_RE.lastIndex = 0
  for (const match of body.matchAll(IMAGE_SIZE_TOKEN_RE)) {
    matchedAny = true
    const [, key, rawValue] = match
    const value = parseImageDimension(rawValue)
    if (!value) {
      continue
    }

    if (key.toLowerCase() === 'width') {
      width = value
    } else if (key.toLowerCase() === 'height') {
      height = value
    }
  }

  if (!matchedAny) {
    return null
  }

  IMAGE_SIZE_TOKEN_RE.lastIndex = 0
  const remainder = body.replace(IMAGE_SIZE_TOKEN_RE, ' ').trim()
  if (remainder) {
    return null
  }

  return width || height ? { width, height } : null
}

function readTrailingImageSize(doc: Text, imageTo: number): ParsedImageSize {
  const line = doc.lineAt(imageTo)
  const trailing = doc.sliceString(imageTo, line.to)

  const braceMatch = trailing.match(/^(\s*)\{([^}\n]+)\}/)
  if (braceMatch) {
    const parsed = parseBraceImageSize(braceMatch[2])
    if (parsed) {
      return {
        replaceTo: imageTo + braceMatch[0].length,
        ...parsed,
      }
    }
  }

  const shorthandMatch = trailing.match(IMAGE_SHORTHAND_SIZE_RE)
  if (shorthandMatch) {
    const width = parseImageDimension(shorthandMatch[2])
    const height = parseImageDimension(shorthandMatch[3])
    if (width && height) {
      return {
        replaceTo: imageTo + shorthandMatch[0].length,
        width,
        height,
      }
    }
  }

  return { replaceTo: imageTo }
}

function serializeImageSize(width: number, height: number) {
  return `{width=${clampImageResizeDimension(width)} height=${clampImageResizeDimension(height)}}`
}

function applyRenderedImageSize(
  widgetRoot: HTMLElement,
  img: HTMLImageElement,
  width?: number,
  height?: number,
) {
  const nextWidth = parseImageDimension(width)
  const nextHeight = parseImageDimension(height)

  widgetRoot.style.width = nextWidth ? `${nextWidth}px` : ''
  img.style.width = nextWidth ? `${nextWidth}px` : ''
  if (nextWidth) {
    img.setAttribute('width', String(nextWidth))
  } else {
    img.removeAttribute('width')
  }

  if (nextHeight) {
    img.style.height = `${nextHeight}px`
    img.setAttribute('height', String(nextHeight))
  } else {
    img.style.height = ''
    img.removeAttribute('height')
  }
}

function getRenderedImageSize(
  widgetRoot: HTMLElement,
  img: HTMLImageElement,
  source: ImageWidgetSource,
): ImageRenderSize | null {
  const imageRect = img.getBoundingClientRect()
  const widgetRect = widgetRoot.getBoundingClientRect()

  const width = parseImageDimension(imageRect.width || widgetRect.width || source.width || img.naturalWidth || 0)
  const height = parseImageDimension(imageRect.height || widgetRect.height || source.height || img.naturalHeight || width || 0)

  if (!width || !height) {
    return null
  }

  const aspectRatio = width / height
  return {
    width,
    height,
    aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1,
  }
}

function computeResizedImageSize(
  session: ImageResizeSession,
  clientX: number,
  clientY: number,
): Pick<ImageResizeSession, 'width' | 'height'> {
  const deltaX = clientX - session.startX
  const deltaY = clientY - session.startY

  if (session.handle === 'e' || session.handle === 'w') {
    const width = clampImageResizeDimension(
      session.handle === 'e' ? session.startWidth + deltaX : session.startWidth - deltaX,
    )
    return {
      width,
      height: clampImageResizeDimension(width / session.aspectRatio),
    }
  }

  if (session.handle === 'n' || session.handle === 's') {
    const height = clampImageResizeDimension(
      session.handle === 's' ? session.startHeight + deltaY : session.startHeight - deltaY,
    )
    return {
      width: clampImageResizeDimension(height * session.aspectRatio),
      height,
    }
  }

  const widthDelta = session.handle.includes('e') ? deltaX : -deltaX
  const heightDelta = session.handle.includes('s') ? deltaY : -deltaY
  const widthScale = (session.startWidth + widthDelta) / session.startWidth
  const heightScale = (session.startHeight + heightDelta) / session.startHeight
  const useWidthAxis = Math.abs(widthDelta / session.startWidth) >= Math.abs(heightDelta / session.startHeight)
  const scale = useWidthAxis ? widthScale : heightScale
  const width = clampImageResizeDimension(session.startWidth * scale)

  return {
    width,
    height: clampImageResizeDimension(width / session.aspectRatio),
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private src: string,
    private alt: string,
    private source: ImageWidgetSource,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const shell = document.createElement('span')
    shell.className = 'mf-image-widget-shell'

    const img = document.createElement('img')
    img.alt = this.alt
    img.className = 'mf-image-widget'
    img.loading = 'lazy'
    img.decoding = 'async'
    applyRenderedImageSize(shell, img, this.source.width, this.source.height)

    let activeResize: ImageResizeSession | null = null

    const updatePreviewSize = (width: number, height: number) => {
      applyRenderedImageSize(shell, img, width, height)
      view.requestMeasure()
    }

    const resetPreviewSize = () => {
      applyRenderedImageSize(shell, img, this.source.width, this.source.height)
      delete shell.dataset.resizing
      activeResize = null
      view.requestMeasure()
    }

    const commitResize = () => {
      if (!activeResize) {
        return
      }

      const { didMove, width, height } = activeResize
      delete shell.dataset.resizing
      activeResize = null

      if (!didMove) {
        resetPreviewSize()
        return
      }

      const nextAttribute = serializeImageSize(width, height)
      const currentAttribute = view.state.doc.sliceString(this.source.imageTo, this.source.replaceTo)
      if (currentAttribute !== nextAttribute) {
        view.dispatch({
          changes: {
            from: this.source.imageTo,
            to: this.source.replaceTo,
            insert: nextAttribute,
          },
        })
      }
    }

    img.onerror = () => {
      imageWidgetCleanup.get(shell)?.()
      const span = document.createElement('span')
      span.className = 'mf-image-error'
      span.textContent = `⚠ ${this.alt || 'Image not found'}`
      shell.replaceChildren(span)
      delete shell.dataset.resizing
      activeResize = null
      view.requestMeasure()
    }
    attachLazyImageSource(shell, img, view, this.src)
    shell.append(img)

    for (const handleName of IMAGE_RESIZE_HANDLES) {
      const handle = document.createElement('span')
      handle.className = `mf-image-resize-handle mf-image-resize-handle--${handleName}`
      handle.dataset.handle = handleName
      handle.setAttribute('aria-hidden', 'true')

      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return
        }

        const startingSize = getRenderedImageSize(shell, img, this.source)
        if (!startingSize) {
          return
        }

        activeResize = {
          ...startingSize,
          pointerId: event.pointerId,
          handle: handleName,
          startX: event.clientX,
          startY: event.clientY,
          startWidth: startingSize.width,
          startHeight: startingSize.height,
          didMove: false,
        }

        shell.dataset.resizing = 'true'
        handle.setPointerCapture?.(event.pointerId)
        event.preventDefault()
        event.stopPropagation()
      })

      handle.addEventListener('pointermove', (event) => {
        if (!activeResize || event.pointerId !== activeResize.pointerId) {
          return
        }

        const nextSize = computeResizedImageSize(activeResize, event.clientX, event.clientY)
        activeResize = {
          ...activeResize,
          ...nextSize,
          didMove: true,
        }
        updatePreviewSize(nextSize.width, nextSize.height)
        event.preventDefault()
        event.stopPropagation()
      })

      handle.addEventListener('pointerup', (event) => {
        if (!activeResize || event.pointerId !== activeResize.pointerId) {
          return
        }

        handle.releasePointerCapture?.(event.pointerId)
        commitResize()
        event.preventDefault()
        event.stopPropagation()
      })

      handle.addEventListener('pointercancel', (event) => {
        if (!activeResize || event.pointerId !== activeResize.pointerId) {
          return
        }

        handle.releasePointerCapture?.(event.pointerId)
        resetPreviewSize()
        event.preventDefault()
        event.stopPropagation()
      })

      shell.append(handle)
    }

    return shell
  }

  eq(other: ImageWidget) {
    return (
      this.src === other.src &&
      this.alt === other.alt &&
      this.source.imageFrom === other.source.imageFrom &&
      this.source.imageTo === other.source.imageTo &&
      this.source.replaceTo === other.source.replaceTo &&
      this.source.width === other.source.width &&
      this.source.height === other.source.height
    )
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
        const imageSize = readTrailingImageSize(doc, to)
        const imageRangeTo = imageSize.replaceTo
        const cursorInsideImage = cursorHead >= from && cursorHead <= imageRangeTo

        if (!cursorInsideImage) {
          const raw = doc.sliceString(from, to)
          const match = raw.match(IMAGE_MARKDOWN_RE)
          if (match) {
            const [, alt, src] = match
            builder.add(
              from,
              imageRangeTo,
              Decoration.replace({
                widget: new ImageWidget(resolveImageSource(src, filePath), alt, {
                  imageFrom: from,
                  imageTo: to,
                  replaceTo: imageRangeTo,
                  width: imageSize.width,
                  height: imageSize.height,
                }),
              }),
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
