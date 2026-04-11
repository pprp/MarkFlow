import { EditorView } from '@codemirror/view'

/**
 * Reading mode extension: makes the editor read-only.
 * Since the editor is not editable, the cursor won't move into decoration
 * ranges, so existing WYSIWYG decorations will unconditionally hide all markup.
 */
export function readingModeExtension() {
  return [
    EditorView.editable.of(false),
    EditorView.contentAttributes.of({ class: 'mf-reading-mode' }),
  ]
}
