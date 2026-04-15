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
])

function sanitizeHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html

  function sanitizeNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tagName)) {
        // Replace disallowed element with its text content
        const text = document.createTextNode(el.textContent ?? '')
        el.replaceWith(text)
        return
      }
      // Remove all attributes (keep it simple and safe)
      const attrNames = Array.from(el.attributes).map((a) => a.name)
      for (const attr of attrNames) {
        el.removeAttribute(attr)
      }
      // Recurse into children
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
