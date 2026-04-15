import { render, waitFor } from '@testing-library/react'
import {
  acceptCompletion,
  CompletionContext,
  completionStatus,
  currentCompletions,
  startCompletion,
} from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'
import {
  emojiAutocompleteExtension,
  emojiCompletionSource,
} from '../extensions/emojiAutocomplete'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

function makeStandaloneView(doc: string) {
  const state = EditorState.create({
    doc,
    selection: { anchor: doc.length },
    extensions: [emojiAutocompleteExtension()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

describe('emoji autocomplete', () => {
  it('returns matching shortcode completions with glyph previews', async () => {
    const doc = 'Hello :smi'
    const result = await emojiCompletionSource(
      new CompletionContext(
        EditorState.create({ doc }),
        doc.length,
        true,
      ),
    )

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.from).toBe('Hello '.length)
    expect(result.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: ':smile:',
          detail: '\u{1F604}',
          apply: '\u{1F604}',
        }),
        expect.objectContaining({
          label: ':smiley:',
          detail: '\u{1F603}',
          apply: '\u{1F603}',
        }),
      ]),
    )
  })

  it('accepts a completion by inserting the Unicode glyph instead of the shortcode', async () => {
    const view = makeStandaloneView('Hello :rocket')

    expect(startCompletion(view)).toBe(true)

    await waitFor(() => {
      expect(currentCompletions(view.state).map((completion) => completion.label)).toContain(':rocket:')
    })

    expect(acceptCompletion(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello \u{1F680}')
    expect(view.state.selection.main.head).toBe('Hello \u{1F680}'.length)

    destroyView(view)
  })

  it('dismisses unknown shortcodes without mutating the document', async () => {
    const doc = 'Hello :zzzz'
    const view = makeStandaloneView(doc)

    expect(startCompletion(view)).toBe(true)

    await waitFor(() => {
      expect(completionStatus(view.state)).toBeNull()
    })

    expect(currentCompletions(view.state)).toHaveLength(0)
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('wires emoji completions into MarkFlowEditor', async () => {
    const { container } = render(
      createElement(MarkFlowEditor, {
        content: 'Hello :tad',
        viewMode: 'source',
        onChange: vi.fn(),
      }),
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    expect(startCompletion(view)).toBe(true)

    await waitFor(() => {
      expect(currentCompletions(view.state)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: ':tada:',
            detail: '\u{1F389}',
          }),
        ]),
      )
    })

    expect(acceptCompletion(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello \u{1F389}')
  })
})
