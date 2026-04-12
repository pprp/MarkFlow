import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'

/**
 * Detects YAML front matter at the very start of the document (a `---`
 * opening fence followed by key-value lines and a closing `---`).
 *
 * All front matter lines receive a `.mf-yaml-frontmatter` line decoration
 * so CSS can visually distinguish metadata from prose.  The fence lines
 * (`---`) get the additional `.mf-yaml-fence` class.  Source text is never
 * mutated; the block stays fully editable at all times.
 *
 * Returns `{ from, to }` of the front matter range, or `null` if none.
 */
export function detectFrontMatter(doc: { lines: number; line: (n: number) => { text: string; from: number } }): { firstLine: number; lastLine: number } | null {
  if (doc.lines < 2) return null
  if (doc.line(1).text.trim() !== '---') return null

  for (let i = 2; i <= doc.lines; i++) {
    const text = doc.line(i).text.trim()
    if (text === '---' || text === '...') {
      return { firstLine: 1, lastLine: i }
    }
  }
  return null
}

export function buildFrontMatterDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const { startLine, endLine } = getDecorationViewportWindow(view)
  const range = detectFrontMatter(doc)
  if (!range) return builder.finish()
  if (range.lastLine < startLine || range.firstLine > endLine) return builder.finish()

  for (let lineNum = range.firstLine; lineNum <= range.lastLine; lineNum++) {
    const line = doc.line(lineNum)
    const isFence = lineNum === range.firstLine || lineNum === range.lastLine
    builder.add(
      line.from,
      line.from,
      Decoration.line({ class: isFence ? 'mf-yaml-fence' : 'mf-yaml-frontmatter' }),
    )
  }

  return builder.finish()
}

export function yamlFrontMatterDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildFrontMatterDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildFrontMatterDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
