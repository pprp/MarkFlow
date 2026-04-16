import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { extractOutlineHeadings, type OutlineHeading } from '../outline'
import { getDecorationViewportWindow } from './viewportWindow'
import {
  DEFAULT_MARKDOWN_MODE,
  type MarkFlowMarkdownMode,
} from '../../markdownMode'

const TOC_LINE_RE = /^\[toc\]\s*$/i

class TocWidget extends WidgetType {
  constructor(private headings: OutlineHeading[]) {
    super()
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'mf-toc'

    const ul = document.createElement('ul')
    for (const heading of this.headings) {
      const li = document.createElement('li')
      li.dataset.level = String(heading.level)
      const a = document.createElement('a')
      // Use mf-link class so modifier-click is handled by the editor's navigation path
      a.className = 'mf-link'
      a.href = `#${heading.anchor}`
      a.textContent = heading.text
      li.appendChild(a)
      ul.appendChild(li)
    }
    container.appendChild(ul)
    return container
  }

  eq(other: TocWidget): boolean {
    if (this.headings.length !== other.headings.length) return false
    return this.headings.every(
      (h, i) =>
        h.anchor === other.headings[i].anchor &&
        h.text === other.headings[i].text &&
        h.level === other.headings[i].level,
    )
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildTocDecorations(view: EditorView, headings: OutlineHeading[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { startLine, endLine } = getDecorationViewportWindow(view)

  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i)
    if (TOC_LINE_RE.test(line.text)) {
      const cursorOnLine = cursorHead >= line.from && cursorHead <= line.to
      if (!cursorOnLine) {
        builder.add(
          line.from,
          line.to,
          Decoration.replace({ widget: new TocWidget(headings) }),
        )
      }
    }
  }

  return builder.finish()
}

export function tocDecorations(markdownMode: MarkFlowMarkdownMode = DEFAULT_MARKDOWN_MODE) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      headings: OutlineHeading[]

      constructor(view: EditorView) {
        this.headings = extractOutlineHeadings(view.state.doc.toString(), markdownMode)
        this.decorations = buildTocDecorations(view, this.headings)
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.headings = extractOutlineHeadings(update.view.state.doc.toString(), markdownMode)
        }
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildTocDecorations(update.view, this.headings)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
