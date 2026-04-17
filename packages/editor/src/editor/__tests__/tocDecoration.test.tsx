import { render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'
import {
  LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS,
} from '../../largeDocument'
import { symbolTableField } from '../indexer'
import * as outline from '../outline'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()
  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()
  return view as EditorView
}

/** Move cursor to end of document so the [toc] widget renders (cursor-on-line hides it). */
function moveCursorToEnd(view: EditorView) {
  view.dispatch({ selection: { anchor: view.state.doc.length } })
}

function moveCursorOffTocNearViewportStart(view: EditorView, anchor: number) {
  view.dispatch({ selection: { anchor } })
}

describe('toc decorations', () => {
  it('renders [toc] as a widget with heading links when cursor is elsewhere', () => {
    const doc = ['[toc]', '', '# Alpha', '', '## Beta'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    moveCursorToEnd(getEditorView(container))

    const toc = container.querySelector('.mf-toc')
    expect(toc).not.toBeNull()

    const links = Array.from(toc!.querySelectorAll('a'))
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Alpha')
    expect(links[0]).toHaveAttribute('href', '#alpha')
    expect(links[1]).toHaveTextContent('Beta')
    expect(links[1]).toHaveAttribute('href', '#beta')
  })

  it('uses mf-link class on TOC anchor elements for modifier-click navigation', () => {
    const doc = ['[toc]', '', '# Heading'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    moveCursorToEnd(getEditorView(container))

    const links = container.querySelectorAll('.mf-toc a.mf-link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '#heading')
  })

  it('de-duplicates anchors for headings with the same text', () => {
    const doc = ['[toc]', '', '# Setup', '', '## Setup', '', '### Setup'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    moveCursorToEnd(getEditorView(container))

    const links = Array.from(container.querySelectorAll('.mf-toc a'))
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '#setup')
    expect(links[1]).toHaveAttribute('href', '#setup-1')
    expect(links[2]).toHaveAttribute('href', '#setup-2')
  })

  it('excludes fenced-code pseudo-headings from the TOC', () => {
    const doc = ['[toc]', '', '# Real', '', '```md', '# fake', '```'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    moveCursorToEnd(getEditorView(container))

    const links = Array.from(container.querySelectorAll('.mf-toc a'))
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent('Real')
  })

  it('includes setext headings in the TOC', () => {
    const doc = ['[toc]', '', 'Title', '=====', '', 'Sub', '---'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    moveCursorToEnd(getEditorView(container))

    const links = Array.from(container.querySelectorAll('.mf-toc a'))
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Title')
    expect(links[1]).toHaveTextContent('Sub')
  })

  it('reveals raw [toc] source when the cursor is on the toc line', () => {
    const doc = ['[toc]', '', '# Heading'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    const view = getEditorView(container)

    // Cursor starts at position 0 (on the [toc] line) — widget should be hidden
    expect(container.querySelector('.mf-toc')).toBeNull()
    expect(container.querySelector('.cm-line')?.textContent).toContain('[toc]')

    // Move cursor away — widget should reappear
    moveCursorToEnd(view)
    expect(container.querySelector('.mf-toc')).not.toBeNull()
  })

  it('does not modify the underlying document content', () => {
    const doc = ['[toc]', '', '# Heading'].join('\n')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    const view = getEditorView(container)

    expect(view.state.doc.toString()).toBe(doc)
  })

  it('uses the background symbol table for large documents instead of reparsing headings in the toc plugin', async () => {
    const doc = [
      '[toc]',
      '',
      '# Alpha',
      '',
      'x'.repeat(LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS),
      '',
      '## Beta',
    ].join('\n')
    const extractHeadingsSpy = vi.spyOn(outline, 'extractOutlineHeadings')
    const { container } = render(<MarkFlowEditor content={doc} viewMode="wysiwyg" onChange={vi.fn()} />)
    const view = getEditorView(container)

    moveCursorOffTocNearViewportStart(view, doc.indexOf('# Alpha') + 2)

    await waitFor(() => {
      expect(view.state.field(symbolTableField).headings.map((heading) => heading.text)).toEqual([
        'Alpha',
        'Beta',
      ])
    })

    expect(extractHeadingsSpy).not.toHaveBeenCalled()
  })
})
