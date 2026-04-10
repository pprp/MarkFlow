import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

function buildActiveLineDecoration(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head)
  builder.add(cursorLine.from, cursorLine.from, Decoration.line({ class: 'mf-focus-active' }))
  return builder.finish()
}

const focusLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildActiveLineDecoration(view)
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged) {
        this.decorations = buildActiveLineDecoration(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/**
 * Focus mode: dims all lines except the line containing the caret.
 * Applies `.mf-focus-mode` to the editor element and marks the active
 * line with `.mf-focus-active` so CSS can restore it to full opacity.
 */
export function focusModeExtension() {
  return [EditorView.editorAttributes.of({ class: 'mf-focus-mode' }), focusLinePlugin]
}

/**
 * Typewriter mode: after each doc or selection change, scrolls the caret
 * to the vertical center of the visible viewport so the active line stays
 * at a stable position while writing.
 */
export function typewriterModeExtension() {
  return ViewPlugin.fromClass(
    class {
      scheduledScroll: ReturnType<typeof requestAnimationFrame> | null = null

      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged) return
        if (this.scheduledScroll !== null) {
          cancelAnimationFrame(this.scheduledScroll)
        }
        this.scheduledScroll = requestAnimationFrame(() => {
          this.scheduledScroll = null
          const pos = update.view.state.selection.main.head
          update.view.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: 'center' }),
          })
        })
      }

      destroy() {
        if (this.scheduledScroll !== null) {
          cancelAnimationFrame(this.scheduledScroll)
        }
      }
    },
  )
}
