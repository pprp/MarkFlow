import { fireEvent, render } from '@testing-library/react'
import { undo } from '@codemirror/commands'
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

describe('MarkFlowEditor', () => {
  it('preserves document state, selection, and undo history across view mode toggles', () => {
    const handleChange = vi.fn()
    const { container, rerender } = render(
      <MarkFlowEditor content="Hello" viewMode="wysiwyg" onChange={handleChange} />,
    )

    const view = getEditorView(container)
    view.dispatch({
      changes: { from: 5, insert: ' world' },
      selection: { anchor: 11 },
    })

    expect(view.state.doc.toString()).toBe('Hello world')
    expect(view.state.selection.main.head).toBe(11)

    rerender(<MarkFlowEditor content="Hello world" viewMode="source" onChange={handleChange} />)

    const toggledView = getEditorView(container)
    expect(toggledView).toBe(view)
    expect(toggledView.state.doc.toString()).toBe('Hello world')
    expect(toggledView.state.selection.main.head).toBe(11)

    expect(undo(toggledView)).toBe(true)
    expect(toggledView.state.doc.toString()).toBe('Hello')
  })

  it('accepts external document replacement without recreating the editor', () => {
    const { container, rerender } = render(
      <MarkFlowEditor content="Draft" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)

    rerender(<MarkFlowEditor content="# Opened file" viewMode="wysiwyg" onChange={vi.fn()} />)

    const updatedView = getEditorView(container)
    expect(updatedView).toBe(view)
    expect(updatedView.state.doc.toString()).toBe('# Opened file')
    expect(updatedView.state.selection.main.head).toBe(0)
  })

  it('calls onToggleMode when Cmd/Ctrl+/ is pressed inside the editor', () => {
    const handleToggleMode = vi.fn()
    const { container } = render(
      <MarkFlowEditor
        content="Toggle me"
        viewMode="wysiwyg"
        onChange={vi.fn()}
        onToggleMode={handleToggleMode}
      />,
    )

    const view = getEditorView(container)

    fireEvent.keyDown(view.contentDOM, { key: '/', ctrlKey: true })

    expect(handleToggleMode).toHaveBeenCalledTimes(1)
  })

  it('jumps to a matching heading on Cmd/Ctrl+Click for internal anchors', () => {
    const content = ['Intro [Jump](#details)', '', '# Details'].join('\n')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(<MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />)

    const view = getEditorView(container)
    const link = container.querySelector('a.mf-link')
    expect(link).not.toBeNull()

    fireEvent.click(link as Element, { ctrlKey: true })

    expect(view.state.selection.main.head).toBe(content.indexOf('# Details'))
    expect(openSpy).not.toHaveBeenCalled()

    openSpy.mockRestore()
  })

  it('resolves local markdown links against the current file path and routes them through onOpenPath', () => {
    const handleOpenPath = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(
      <MarkFlowEditor
        content="Start [Sibling](./sibling.md)"
        viewMode="wysiwyg"
        onChange={vi.fn()}
        onOpenPath={handleOpenPath}
        filePath="/Users/pprp/docs/current.md"
      />,
    )

    const link = container.querySelector('a.mf-link')
    expect(link).toHaveAttribute('href', 'file:///Users/pprp/docs/sibling.md')

    fireEvent.click(link as Element, { ctrlKey: true })

    expect(handleOpenPath).toHaveBeenCalledWith('/Users/pprp/docs/sibling.md')
    expect(openSpy).not.toHaveBeenCalled()

    openSpy.mockRestore()
  })
})
