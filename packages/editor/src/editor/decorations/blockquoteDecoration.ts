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

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'mf-hr-widget'
    return hr
  }
  eq() {
    return true
  }
  get estimatedHeight() {
    return 24
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const decoratedLines = new Set<number>()

  syntaxTree(view.state).iterate({
    enter(node) {
      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (node.name === 'Blockquote') {
        const firstLine = doc.lineAt(from)
        const lastLine = doc.lineAt(to)

        for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
          if (decoratedLines.has(lineNum)) {
            continue
          }

          decoratedLines.add(lineNum)
          const line = doc.line(lineNum)
          builder.add(line.from, line.from, Decoration.line({ class: 'mf-blockquote' }))

          if (!cursorInside) {
            const match = line.text.match(/^(\s*(?:>\s?)+)/)
            if (match) {
              builder.add(line.from, line.from + match[1].length, Decoration.replace({}))
            }
          }
        }
        return
      }

      if (node.name === 'HorizontalRule') {
        if (!cursorInside) {
          builder.add(from, to, Decoration.replace({ widget: new HrWidget() }))
        }
      }
    },
  })

  return builder.finish()
}

export function blockquoteDecorations() {
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
