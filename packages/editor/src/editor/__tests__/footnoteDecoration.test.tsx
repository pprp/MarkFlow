import { render } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

function lineText(container: HTMLElement, index: number) {
  const line = container.querySelectorAll('.cm-line').item(index)
  return line?.textContent ?? ''
}

describe('footnote decorations', () => {
  it('renders footnote references as superscript markers with hover preview text', () => {
    const doc = ['Intro[^1] after', '', '[^1]: Footnote body'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)

    const reference = container.querySelector('sup.mf-footnote-ref')
    expect(reference).not.toBeNull()
    expect(reference).toHaveTextContent('1')
    expect(reference).toHaveAttribute('title', 'Footnote body')
    expect(reference).toHaveAttribute('data-footnote-label', '1')
    expect(container.querySelector('.mf-link')).toBeNull()
    expect(lineText(container, 0)).toBe('Intro1 after')
    expect(lineText(container, 2)).toBe('[^1]: Footnote body')
    expect(getEditorView(container).state.doc.toString()).toBe(doc)
  })

  it('reveals raw footnote markdown while the caret is inside the reference and restores the superscript after leaving', () => {
    const doc = ['Intro[^1] after', '', '[^1]: Footnote body'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    const view = getEditorView(container)

    view.dispatch({ selection: { anchor: doc.indexOf('^1') } })

    expect(container.querySelector('sup.mf-footnote-ref')).toBeNull()
    expect(lineText(container, 0)).toContain('Intro[^1] after')
    expect(view.state.doc.toString()).toBe(doc)

    view.dispatch({ selection: { anchor: doc.length } })

    expect(container.querySelector('sup.mf-footnote-ref')).toHaveTextContent('1')
    expect(lineText(container, 0)).toBe('Intro1 after')
  })

  it('keeps repeated references in sync with edited definition text and marks missing definitions gracefully', () => {
    const doc = ['One[^note] two[^note] miss[^missing]', '', '[^note]: Original body'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    const view = getEditorView(container)

    const initialReferences = Array.from(container.querySelectorAll('sup.mf-footnote-ref'))
    expect(initialReferences).toHaveLength(3)
    expect(initialReferences[0]).toHaveAttribute('title', 'Original body')
    expect(initialReferences[1]).toHaveAttribute('title', 'Original body')
    expect(initialReferences[2]).toHaveClass('mf-footnote-missing')
    expect(initialReferences[2]).toHaveAttribute('title', 'Missing footnote: missing')

    const bodyStart = view.state.doc.toString().indexOf('Original body')
    view.dispatch({
      changes: {
        from: bodyStart,
        to: bodyStart + 'Original body'.length,
        insert: 'Updated body text',
      },
    })

    const updatedReferences = Array.from(container.querySelectorAll('sup.mf-footnote-ref'))
    expect(updatedReferences[0]).toHaveAttribute('title', 'Updated body text')
    expect(updatedReferences[1]).toHaveAttribute('title', 'Updated body text')
    expect(view.state.doc.toString()).toBe(['One[^note] two[^note] miss[^missing]', '', '[^note]: Updated body text'].join('\n'))
  })

  it('avoids false positives inside code while preserving regular links beside footnotes', () => {
    const doc = [
      'Use `[^code]` and [Docs](./guide.md) plus [^1]',
      '',
      '[^1]: Real footnote',
      '',
      '```md',
      '[^2]',
      '```',
    ].join('\n')
    const { container } = render(
      <MarkFlowEditor
        content={doc}
        viewMode="wysiwyg"
        onChange={vi.fn()}
        filePath="/Users/pprp/docs/current.md"
      />,
    )

    const footnotes = Array.from(container.querySelectorAll('sup.mf-footnote-ref'))
    expect(footnotes).toHaveLength(1)
    expect(footnotes[0]).toHaveTextContent('1')
    expect(container.querySelector('.mf-inline-code')).toHaveTextContent('[^code]')

    const links = Array.from(container.querySelectorAll('a.mf-link'))
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Docs')
    expect(links[0]).toHaveAttribute('href', 'file:///Users/pprp/docs/guide.md')
    expect(container.textContent).toContain('[^2]')
    expect(getEditorView(container).state.doc.toString()).toBe(doc)
  })
})
