import { fireEvent, render } from '@testing-library/react'
import { undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'

interface PointerEventInitWithId extends MouseEventInit {
  pointerId?: number
}

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

  it('renders split view correctly and syncs changes from source to preview', () => {
    const { container, rerender } = render(
      <MarkFlowEditor content="Hello" viewMode="split" onChange={vi.fn()} />,
    )

    const editors = container.querySelectorAll('.cm-editor')
    expect(editors).toHaveLength(2)

    const sourceView = EditorView.findFromDOM(editors[0] as HTMLElement)
    const previewView = EditorView.findFromDOM(editors[1] as HTMLElement)

    expect(sourceView).not.toBeNull()
    expect(previewView).not.toBeNull()

    expect(sourceView!.state.doc.toString()).toBe('Hello')
    expect(previewView!.state.doc.toString()).toBe('Hello')

    // Modify source and check if preview updates
    sourceView!.dispatch({
      changes: { from: 5, insert: ' world' }
    })
    
    // After dispatch, onChange is typically called. The parent component usually rerenders.
    // In this component test, we simulate the parent rerender with the new content
    rerender(<MarkFlowEditor content="Hello world" viewMode="split" onChange={vi.fn()} />)

    expect(previewView!.state.doc.toString()).toBe('Hello world')
  })

  it('adjusts layout correctly on pane resize', () => {
    const { container } = render(
      <MarkFlowEditor content="Split" viewMode="split" onChange={vi.fn()} />,
    )

    const divider = container.querySelector('.mf-split-divider')
    expect(divider).not.toBeNull()

    const splitContainer = container.querySelector('.mf-split-container')
    expect(splitContainer).not.toBeNull()
    


// PointerEvent polyfill for jsdom
    if (!window.PointerEvent) {
      class MockPointerEvent extends MouseEvent {
        pointerId: number

        constructor(type: string, params: PointerEventInitWithId = {}) {
          super(type, params)
          this.pointerId = params.pointerId ?? 1
        }
      }

      Object.defineProperty(window, 'PointerEvent', {
        configurable: true,
        writable: true,
        value: MockPointerEvent,
      })
    }
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 1000,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {}
    }))

    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()


    const panes = container.querySelectorAll('.mf-split-pane')
    expect(panes).toHaveLength(2)

    // Initial state (ratio 0.5)
    expect((panes[0] as HTMLElement).style.flexGrow).toBe('0.5')
    expect((panes[1] as HTMLElement).style.flexGrow).toBe('0.5')

    // Simulate pointer down, move, and up
    fireEvent.pointerDown(divider as Element, { pointerId: 1 })
    fireEvent.pointerMove(divider as Element, { pointerId: 1, clientX: 300 })
    fireEvent.pointerUp(divider as Element, { pointerId: 1 })

    // 300 / 1000 = 0.3
    expect((panes[0] as HTMLElement).style.flexGrow).toBe('0.3')
    expect((panes[1] as HTMLElement).style.flexGrow).toBe('0.7')
    
    // Limits
    fireEvent.pointerDown(divider as Element, { pointerId: 1 })
    fireEvent.pointerMove(divider as Element, { pointerId: 1, clientX: 50 })
    fireEvent.pointerUp(divider as Element, { pointerId: 1 })
    
    // Should cap at 0.1
    expect((panes[0] as HTMLElement).style.flexGrow).toBe('0.1')
    expect((panes[1] as HTMLElement).style.flexGrow).toBe('0.9')
  })
})
