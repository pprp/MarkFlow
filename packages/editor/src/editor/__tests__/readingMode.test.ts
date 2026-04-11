import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { readingModeExtension } from '../extensions/readingMode'

describe('Reading mode extension', () => {
  it('makes the editor read-only and adds the reading mode class', () => {
    const state = EditorState.create({
      doc: '# Hello',
      extensions: [readingModeExtension()]
    })
    const view = new EditorView({ state })

    expect(view.contentDOM.getAttribute('class')).toContain('mf-reading-mode')
    
    // Attempt to type should fail since it's read only
    // In CodeMirror, readOnly status is accessible via the EditorState's readOnly facet
    // Note: editable facet is view-specific, EditorState.readOnly facet is state-specific
    expect(view.state.facet(EditorView.editable)).toBe(false)
  })
})
