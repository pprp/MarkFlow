import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

const headingClasses: Record<string, string> = {
  ATXHeading1: 'mf-h1',
  ATXHeading2: 'mf-h2',
  ATXHeading3: 'mf-h3',
  ATXHeading4: 'mf-h4',
  ATXHeading5: 'mf-h5',
  ATXHeading6: 'mf-h6',
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc

  syntaxTree(view.state).iterate({
    enter(node) {
      const { from, to } = node

      // ── Headings ──────────────────────────────────────────────────────────
      const headingClass = headingClasses[node.name]
      if (headingClass) {
        const lineStart = doc.lineAt(from).from
        const lineEnd = doc.lineAt(to).to
        const cursorInside = cursorHead >= lineStart && cursorHead <= lineEnd

        // Decoration.line() must be added first (startSide = -1 < replace's startSide = 1)
        builder.add(lineStart, lineStart, Decoration.line({ class: headingClass }))

        if (!cursorInside) {
          const firstChild = node.node.firstChild
          if (firstChild && firstChild.name === 'HeaderMark') {
            // Hide "## " — HeaderMark + the space that follows
            const markEnd = Math.min(firstChild.to + 1, to)
            builder.add(firstChild.from, markEnd, Decoration.replace({}))
          }
        }
        // Let the iterator visit child nodes (StrongEmphasis etc.) inside the heading
        return
      }

      // ── StrongEmphasis (bold **text**) ────────────────────────────────────
      if (node.name === 'StrongEmphasis') {
        const cursorInside = cursorHead >= from && cursorHead <= to
        if (!cursorInside) {
          // Apply mark only to the content between the ** markers to avoid overlap
          const contentFrom = from + 2
          const contentTo = to - 2
          if (contentFrom < contentTo) {
            builder.add(from, from + 2, Decoration.replace({}))
            builder.add(contentFrom, contentTo, Decoration.mark({ class: 'mf-bold' }))
            builder.add(to - 2, to, Decoration.replace({}))
          }
        }
        return false // skip children — we've handled this node
      }

      // ── Emphasis (italic *text*) ──────────────────────────────────────────
      if (node.name === 'Emphasis') {
        const cursorInside = cursorHead >= from && cursorHead <= to
        if (!cursorInside) {
          const contentFrom = from + 1
          const contentTo = to - 1
          if (contentFrom < contentTo) {
            builder.add(from, from + 1, Decoration.replace({}))
            builder.add(contentFrom, contentTo, Decoration.mark({ class: 'mf-italic' }))
            builder.add(to - 1, to, Decoration.replace({}))
          }
        }
        return false
      }

      // ── Strikethrough (~~text~~) ──────────────────────────────────────────
      if (node.name === 'Strikethrough') {
        const cursorInside = cursorHead >= from && cursorHead <= to
        if (!cursorInside) {
          const contentFrom = from + 2
          const contentTo = to - 2
          if (contentFrom < contentTo) {
            builder.add(from, from + 2, Decoration.replace({}))
            builder.add(contentFrom, contentTo, Decoration.mark({ class: 'mf-strikethrough' }))
            builder.add(to - 2, to, Decoration.replace({}))
          }
        }
        return false
      }

      // ── InlineCode (`code`) ───────────────────────────────────────────────
      if (node.name === 'InlineCode') {
        const cursorInside = cursorHead >= from && cursorHead <= to
        if (!cursorInside) {
          const contentFrom = from + 1
          const contentTo = to - 1
          if (contentFrom < contentTo) {
            builder.add(from, from + 1, Decoration.replace({}))
            builder.add(contentFrom, contentTo, Decoration.mark({ class: 'mf-inline-code' }))
            builder.add(to - 1, to, Decoration.replace({}))
          }
        }
        return false
      }
    },
  })

  return builder.finish()
}

export function wysiwygDecorations() {
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
