import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

interface DecorationEntry {
  from: number
  to: number
  decoration: Decoration
  order: number
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const entries: DecorationEntry[] = []
  let order = 0

  const addDecoration = (from: number, to: number, decoration: Decoration) => {
    entries.push({ from, to, decoration, order: order++ })
  }

  syntaxTree(view.state).iterate({
    enter(node) {
      const { from, to } = node

      if (node.name === 'Table') {
        const cursorInside = cursorHead >= from && cursorHead <= to

        // Find header row to differentiate it from body rows
        let headerRowTo = -1
        const tableNode = node.node
        const firstChild = tableNode.firstChild
        if (firstChild && firstChild.name === 'TableHeader') {
          headerRowTo = firstChild.to
        }

        if (!cursorInside) {
          // Walk over each line in the table and add row decorations
          const firstLine = doc.lineAt(from)
          const lastLine = doc.lineAt(to)

          for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
            const line = doc.line(lineNum)

            // Check if this is the header row
            const isHeader = headerRowTo !== -1 && line.from <= headerRowTo
            const lineClass = isHeader ? 'mf-table-row mf-table-header-row' : 'mf-table-row'
            addDecoration(line.from, line.from, Decoration.line({ class: lineClass }))

            // Check if this is the delimiter row (---)
            const trimmed = line.text.trim()
            const isDelimiterRow =
              trimmed.length > 0 &&
              /^[|:\- ]+$/.test(trimmed) &&
              trimmed.includes('-')

            if (isDelimiterRow) {
              // Hide the entire delimiter line
              addDecoration(
                line.from,
                line.to,
                Decoration.mark({ class: 'mf-table-delimiter' }),
              )
            } else {
              // Hide pipe separators, mark cell content
              const text = line.text
              let pos = 0

              // Hide leading pipe
              if (text[pos] === '|') {
                addDecoration(line.from + pos, line.from + pos + 1, Decoration.replace({}))
                pos++
              }

              while (pos < text.length) {
                // Find the next pipe
                const nextPipe = text.indexOf('|', pos)
                if (nextPipe === -1) {
                  // No more pipes; rest is trailing text
                  if (pos < text.length) {
                    const cellFrom = line.from + pos
                    const cellTo = line.from + text.length
                    if (cellFrom < cellTo) {
                      addDecoration(cellFrom, cellTo, Decoration.mark({ class: 'mf-table-cell' }))
                    }
                  }
                  break
                }

                // Mark cell content between pos and nextPipe
                const cellFrom = line.from + pos
                const cellTo = line.from + nextPipe
                if (cellFrom < cellTo) {
                  addDecoration(cellFrom, cellTo, Decoration.mark({ class: 'mf-table-cell' }))
                }

                // Hide the pipe separator
                addDecoration(
                  line.from + nextPipe,
                  line.from + nextPipe + 1,
                  Decoration.replace({}),
                )

                pos = nextPipe + 1
              }
            }
          }
        } else {
          // Cursor inside: just add row class decorations without hiding pipes
          const firstLine = doc.lineAt(from)
          const lastLine = doc.lineAt(to)
          for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
            const line = doc.line(lineNum)
            const isHeader = headerRowTo !== -1 && line.from <= headerRowTo
            const lineClass = isHeader ? 'mf-table-row mf-table-header-row' : 'mf-table-row'
            addDecoration(line.from, line.from, Decoration.line({ class: lineClass }))
          }
        }

        return false // don't descend into table children
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

export function tableDecorations() {
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
