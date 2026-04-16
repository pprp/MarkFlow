import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { foldable, foldedRanges } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'
import { headingFoldExtension } from '../extensions/headingFold'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

function countCollapsedRanges(view: EditorView) {
  let count = 0
  foldedRanges(view.state).between(0, view.state.doc.length, () => {
    count += 1
  })
  return count
}

describe('markdown folding ranges', () => {
  it('covers heading sections, lists, and fenced code blocks', () => {
    const doc = [
      '# H1',
      'intro',
      '# H1b',
      'details',
      '- item 1',
      '  - nested',
      '- item 2',
      '',
      '```js',
      'console.log(1)',
      '```',
    ].join('\n')

    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), ...headingFoldExtension()],
    })

    expect(foldable(state, state.doc.line(1).from, state.doc.line(1).to)).toEqual({
      from: state.doc.line(1).to,
      to: state.doc.line(2).to,
    })
    expect(foldable(state, state.doc.line(3).from, state.doc.line(3).to)).toEqual({
      from: state.doc.line(3).to,
      to: state.doc.line(11).to,
    })
    expect(foldable(state, state.doc.line(5).from, state.doc.line(5).to)).toEqual({
      from: state.doc.line(5).to,
      to: state.doc.line(7).to,
    })
    expect(foldable(state, state.doc.line(9).from, state.doc.line(9).to)).toEqual({
      from: state.doc.line(9).to,
      to: state.doc.line(11).to,
    })
  })
})

describe('MarkFlowEditor folding', () => {
  it('toggles folding from the gutter and reports collapsed ranges', async () => {
    const handleCollapsedRangesChange = vi.fn()
    const content = ['# Heading', 'Body line', '# Next', 'Rest'].join('\n')
    const { container } = render(
      <MarkFlowEditor
        content={content}
        viewMode="wysiwyg"
        onChange={vi.fn()}
        onCollapsedRangesChange={handleCollapsedRangesChange}
      />,
    )

    const view = getEditorView(container)
    const expectedRange = {
      from: view.state.doc.line(1).to,
      to: view.state.doc.line(2).to,
    }

    const foldToggle = container.querySelector('.cm-foldGutter span')
    expect(foldToggle).not.toBeNull()

    fireEvent.click(foldToggle as HTMLElement)

    await waitFor(() => {
      expect(countCollapsedRanges(view)).toBe(1)
      expect(handleCollapsedRangesChange).toHaveBeenLastCalledWith([
        expectedRange.from,
        expectedRange.to,
      ])
    })

    fireEvent.click(container.querySelector('.cm-foldGutter span') as HTMLElement)

    await waitFor(() => {
      expect(countCollapsedRanges(view)).toBe(0)
      expect(handleCollapsedRangesChange).toHaveBeenLastCalledWith([])
    })
  })

  it('restores persisted folding ranges passed in through props', async () => {
    const content = ['# Heading', 'Body line', '# Next', 'Rest'].join('\n')
    const state = EditorState.create({
      doc: content,
      extensions: [markdown({ base: markdownLanguage }), ...headingFoldExtension()],
    })
    const restoredRanges = [state.doc.line(1).to, state.doc.line(2).to]

    const { container } = render(
      <MarkFlowEditor
        content={content}
        viewMode="wysiwyg"
        onChange={vi.fn()}
        collapsedRanges={restoredRanges}
      />,
    )

    const view = getEditorView(container)

    await waitFor(() => {
      expect(countCollapsedRanges(view)).toBe(1)
      expect(container.querySelector('.cm-foldPlaceholder')).not.toBeNull()
    })
  })
})
