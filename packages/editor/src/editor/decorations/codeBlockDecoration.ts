import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return

      // Skip fenced blocks that have dedicated renderers (e.g. mermaid diagrams).
      // Applying generic code-block decorations on the same range would conflict
      // with the specialised widget replace decoration.
      const infoNode = node.node.getChild('CodeInfo')
      if (infoNode) {
        const lang = doc.sliceString(infoNode.from, infoNode.to).trim().toLowerCase()
        if (lang === 'mermaid') return
      }

      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      const firstLine = doc.lineAt(from)
      const lastLine = doc.lineAt(to)

      // When cursor is outside, hide only the fence line text itself.
      // CodeMirror view plugins cannot create replace decorations that span
      // line breaks, so we keep the line boundaries intact here.
      if (!cursorInside) {
        builder.add(firstLine.from, firstLine.to, Decoration.replace({}))
      }

      // Style content lines (always skip the fence lines themselves)
      for (let lineNum = firstLine.number + 1; lineNum <= lastLine.number - 1; lineNum++) {
        const line = doc.line(lineNum)
        const classes = ['mf-code-block-line']
        if (lineNum === firstLine.number + 1) classes.push('mf-code-block-first')
        if (lineNum === lastLine.number - 1) classes.push('mf-code-block-last')
        builder.add(line.from, line.from, Decoration.line({ class: classes.join(' ') }))
      }

      if (!cursorInside && lastLine.from !== firstLine.from) {
        builder.add(lastLine.from, lastLine.to, Decoration.replace({}))
      }
    },
  })

  return builder.finish()
}

export function codeBlockDecorations() {
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
