import { EditorView, ViewPlugin } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

/**
 * Reading mode extension: makes the editor read-only.
 * We also park the cursor at the end of the document so that no decoration
 * range is considered "cursor-inside", ensuring all markup is fully hidden.
 */
export function readingModeExtension() {
  return [
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ class: 'mf-reading-mode' }),
    // Park cursor at doc end once on mount — no recurring dispatch needed.
    ViewPlugin.define((view) => {
      queueMicrotask(() => {
        const docLen = view.state.doc.length
        if (view.state.selection.main.head !== docLen) {
          view.dispatch({ selection: EditorSelection.cursor(docLen) })
        }
      })
      return {}
    }),
  ]
}
