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

export function resolveImageSource(src: string, filePath?: string) {
  const trimmedSrc = src.trim()
  if (!trimmedSrc || trimmedSrc.startsWith('//')) {
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

export function buildLinkDecorations(view: EditorView, filePath?: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc

  syntaxTree(view.state).iterate({
    enter(node) {
      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (node.name === 'Image') {
        if (!cursorInside) {
          // Extract alt and url from the image syntax ![alt](url)
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
        return
      }

      if (node.name === 'Link') {
        if (!cursorInside) {
          // Hide [, ](url) — keep only the link text visible
          const raw = doc.sliceString(from, to)
          const match = raw.match(/^\[([^\]]*)\]\(([^)]*)\)/)
          if (match) {
            const href = match[2].trim()
            const textFrom = from + 1
            const textTo = textFrom + match[1].length
            const textEnd = textTo + 1
            // Hide opening [
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
            // Hide ](url)
            builder.add(textEnd, to, Decoration.replace({}))
          }
        } else {
          builder.add(from, to, Decoration.mark({ class: 'mf-link' }))
        }
        return
      }
    },
  })

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
