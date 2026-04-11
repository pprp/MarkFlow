import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

const TOC_LINE_RE = /^\[toc\]\s*$/i
const HEADING_RE = /^(#{1,6})\s+(.+)$/gm

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

interface Heading {
  level: number
  text: string
  anchor: string
}

function parseHeadings(doc: string): Heading[] {
  const headings: Heading[] = []
  let match: RegExpExecArray | null
  HEADING_RE.lastIndex = 0
  while ((match = HEADING_RE.exec(doc)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      anchor: slugify(match[2].trim()),
    })
  }
  return headings
}

class TocWidget extends WidgetType {
  constructor(private docContent: string) {
    super()
  }

  toDOM(): HTMLElement {
    const headings = parseHeadings(this.docContent)
    const container = document.createElement('div')
    container.className = 'mf-toc'

    const ul = document.createElement('ul')
    for (const heading of headings) {
      const li = document.createElement('li')
      li.dataset.level = String(heading.level)
      const a = document.createElement('a')
      a.href = `#${heading.anchor}`
      a.textContent = heading.text
      li.appendChild(a)
      ul.appendChild(li)
    }
    container.appendChild(ul)
    return container
  }

  eq(): boolean {
    return false
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildTocDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const docContent = doc.toString()

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    if (TOC_LINE_RE.test(line.text)) {
      const cursorOnLine = cursorHead >= line.from && cursorHead <= line.to
      if (!cursorOnLine) {
        builder.add(
          line.from,
          line.to,
          Decoration.replace({ widget: new TocWidget(docContent) }),
        )
      }
    }
  }

  return builder.finish()
}

export function tocDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildTocDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildTocDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
