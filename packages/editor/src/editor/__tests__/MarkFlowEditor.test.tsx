import { fireEvent, render } from '@testing-library/react'
import { isolateHistory, redo, undo, undoDepth } from '@codemirror/commands'
import { EditorSelection, Transaction } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { MarkFlowEditor } from '../MarkFlowEditor'
import { MAX_UNDO_HISTORY_EVENTS } from '../historyLimit'
import { symbolTableField } from '../indexer'
import * as outline from '../outline'

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

function dispatchEditorShortcut(
  view: EditorView,
  init: KeyboardEventInit & { key: string; keyCode?: number },
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })

  if (typeof init.keyCode === 'number') {
    Object.defineProperty(event, 'keyCode', { configurable: true, get: () => init.keyCode })
  }

  expect(runScopeHandlers(view, event, 'editor')).toBe(true)
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

  it('publishes symbol table updates from the background indexer', async () => {
    const handleSymbolTableChange = vi.fn()
    render(
      <MarkFlowEditor
        content={['# Intro', '', '## Setup'].join('\n')}
        viewMode="wysiwyg"
        onChange={vi.fn()}
        onSymbolTableChange={handleSymbolTableChange}
      />,
    )

    await waitFor(() => {
      const latestTable = handleSymbolTableChange.mock.calls.at(-1)?.[0]
      expect(latestTable?.headings.map((heading: { text: string }) => heading.text)).toEqual([
        'Intro',
        'Setup',
      ])
      expect(latestTable?.anchors.get('intro')).toBe(0)
      expect(latestTable?.anchors.get('setup')).toBe(9)
    })
  })

  it('reports viewport updates when the editor scroll container scrolls', async () => {
    const handleViewportPositionChange = vi.fn()
    const { container } = render(
      <MarkFlowEditor
        content={['# Intro', '', '## Setup', '', '## Details'].join('\n')}
        viewMode="wysiwyg"
        onChange={vi.fn()}
        onViewportPositionChange={handleViewportPositionChange}
      />,
    )

    handleViewportPositionChange.mockClear()

    const view = getEditorView(container)
    fireEvent.scroll(view.scrollDOM)

    await waitFor(() => {
      expect(handleViewportPositionChange).toHaveBeenCalledWith(view.viewport.from)
    })
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

  it('opens the find-and-replace panel and focuses the replace field on Cmd/Ctrl+H', async () => {
    const { container } = render(
      <MarkFlowEditor content="Alpha beta Alpha" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)

    fireEvent.keyDown(view.contentDOM, { key: 'h', ctrlKey: true })

    await waitFor(() => {
      const replaceField = container.querySelector('.cm-search input[name="replace"]')
      expect(replaceField).not.toBeNull()
      expect(view.root.activeElement).toBe(replaceField)
    })
  })

  it('moves the active line up and down with Alt+Arrow shortcuts', () => {
    const content = ['alpha', 'beta', 'gamma'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 2 } })

    dispatchEditorShortcut(view, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      altKey: true,
    })
    expect(view.state.doc.toString()).toBe(['alpha', 'gamma', 'beta'].join('\n'))
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe('beta')

    dispatchEditorShortcut(view, {
      key: 'ArrowUp',
      code: 'ArrowUp',
      keyCode: 38,
      altKey: true,
    })
    expect(view.state.doc.toString()).toBe(content)
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe('beta')
  })

  it('moves a multi-line selection as a block while preserving the moved selection', () => {
    const content = ['one', 'two', 'three', 'four'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({
      selection: EditorSelection.range(view.state.doc.line(2).from, view.state.doc.line(3).to),
    })

    dispatchEditorShortcut(view, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      altKey: true,
    })

    expect(view.state.doc.toString()).toBe(['one', 'four', 'two', 'three'].join('\n'))

    const selection = view.state.selection.main
    expect(view.state.sliceDoc(selection.from, selection.to)).toBe(['two', 'three'].join('\n'))
    expect(selection.anchor).toBe(view.state.doc.line(3).from)
    expect(selection.head).toBe(view.state.doc.line(4).to)

    dispatchEditorShortcut(view, {
      key: 'ArrowUp',
      code: 'ArrowUp',
      keyCode: 38,
      altKey: true,
    })

    expect(view.state.doc.toString()).toBe(content)

    const restoredSelection = view.state.selection.main
    expect(view.state.sliceDoc(restoredSelection.from, restoredSelection.to)).toBe(['two', 'three'].join('\n'))
    expect(restoredSelection.anchor).toBe(view.state.doc.line(2).from)
    expect(restoredSelection.head).toBe(view.state.doc.line(3).to)
  })

  it('treats Alt+Arrow line moves as a single undoable history step', () => {
    const content = ['start', 'middle', 'end'].join('\n')
    const movedContent = ['start', 'end', 'middle'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 2 } })

    dispatchEditorShortcut(view, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      altKey: true,
    })
    expect(view.state.doc.toString()).toBe(movedContent)

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(content)
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe('middle')

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(movedContent)
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe('middle')
  })

  it('converts the current line between paragraph and heading with Cmd/Ctrl+1 and Cmd/Ctrl+0', () => {
    const { container } = render(
      <MarkFlowEditor content="Plain paragraph" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: 6 } })

    fireEvent.keyDown(view.contentDOM, { key: '1', ctrlKey: true })
    expect(view.state.doc.toString()).toBe('# Plain paragraph')

    fireEvent.keyDown(view.contentDOM, { key: '0', ctrlKey: true })
    expect(view.state.doc.toString()).toBe('Plain paragraph')
  })

  it('changes only the active line when applying a different heading level shortcut', () => {
    const content = ['First line', '## Second line', 'Third line'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    const secondLineStart = content.indexOf('## Second line')
    view.dispatch({ selection: { anchor: secondLineStart + 4 } })

    fireEvent.keyDown(view.contentDOM, { key: '4', ctrlKey: true })

    expect(view.state.doc.toString()).toBe(['First line', '#### Second line', 'Third line'].join('\n'))
  })

  it('promotes and demotes only the active heading line with Cmd/Ctrl+= and Cmd/Ctrl+-', () => {
    const content = ['First line', '## Second line', 'Third line'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 4 } })

    fireEvent.keyDown(view.contentDOM, { key: '=', ctrlKey: true })

    expect(view.state.doc.toString()).toBe(['First line', '### Second line', 'Third line'].join('\n'))

    fireEvent.keyDown(view.contentDOM, { key: '-', ctrlKey: true })

    expect(view.state.doc.toString()).toBe(content)
  })

  it('handles heading shortcut boundary cases without mutating other lines', () => {
    const content = ['# Top line', '###### Deep line', 'Plain paragraph'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)

    view.dispatch({ selection: { anchor: view.state.doc.line(1).from + 2 } })
    fireEvent.keyDown(view.contentDOM, { key: '-', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Top line', '###### Deep line', 'Plain paragraph'].join('\n'))

    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 4 } })
    fireEvent.keyDown(view.contentDOM, { key: '=', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Top line', '###### Deep line', 'Plain paragraph'].join('\n'))

    view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 2 } })
    fireEvent.keyDown(view.contentDOM, { key: '-', ctrlKey: true })
    fireEvent.keyDown(view.contentDOM, { key: '=', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Top line', '###### Deep line', 'Plain paragraph'].join('\n'))
  })

  it('configures Alt-click as the gesture for adding another cursor', () => {
    const { container } = render(
      <MarkFlowEditor content="alpha\nbeta\ngamma" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    const clickAddsSelectionRange = view.state.facet(EditorView.clickAddsSelectionRange)[0]

    expect(clickAddsSelectionRange(new MouseEvent('mousedown', { altKey: true }))).toBe(true)
    expect(clickAddsSelectionRange(new MouseEvent('mousedown', { ctrlKey: true }))).toBe(false)
    expect(clickAddsSelectionRange(new MouseEvent('mousedown'))).toBe(false)
  })

  it('edits simultaneously across multiple cursors', () => {
    const { container } = render(
      <MarkFlowEditor content={['foo', 'bar', 'baz'].join('\n')} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    const selections = EditorSelection.create([
      EditorSelection.cursor(view.state.doc.line(1).from),
      EditorSelection.cursor(view.state.doc.line(2).from),
      EditorSelection.cursor(view.state.doc.line(3).from),
    ])

    view.dispatch({ selection: selections })
    view.dispatch(view.state.replaceSelection('> '))

    expect(view.state.doc.toString()).toBe(['> foo', '> bar', '> baz'].join('\n'))
    expect(view.state.selection.ranges).toHaveLength(3)
  })

  it('selects the next occurrence with Cmd/Ctrl+D when multiple selections are enabled', () => {
    const { container } = render(
      <MarkFlowEditor content="foo foo foo" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: EditorSelection.range(0, 3) })

    fireEvent.keyDown(view.contentDOM, { key: 'd', ctrlKey: true })
    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [0, 3],
      [4, 7],
    ])

    fireEvent.keyDown(view.contentDOM, { key: 'd', ctrlKey: true })
    expect(view.state.selection.ranges.map((range) => [range.from, range.to])).toEqual([
      [0, 3],
      [4, 7],
      [8, 11],
    ])
  })

  it('collapses multiple cursors back to the primary caret with Escape', () => {
    const { container } = render(
      <MarkFlowEditor content={['foo', 'bar', 'baz'].join('\n')} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.cursor(view.state.doc.line(1).from),
        EditorSelection.cursor(view.state.doc.line(2).from + 1),
        EditorSelection.cursor(view.state.doc.line(3).from + 2),
      ]),
    })

    fireEvent.keyDown(view.contentDOM, { key: 'Escape' })

    expect(view.state.selection.ranges).toHaveLength(1)
    expect(view.state.selection.main.head).toBe(view.state.doc.line(1).from)
  })

  it('caps undo history at 500 edit events and stops cleanly after that point', async () => {
    const { container } = render(
      <MarkFlowEditor content="" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    for (let index = 0; index < 600; index += 1) {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: String(index % 10) },
        annotations: [
          Transaction.time.of(index * 1000),
          Transaction.userEvent.of('input.type'),
          isolateHistory.of('full'),
        ],
      })
    }

    await waitFor(() => {
      expect(undoDepth(view.state)).toBe(MAX_UNDO_HISTORY_EVENTS)
    })

    for (let index = 0; index < MAX_UNDO_HISTORY_EVENTS; index += 1) {
      expect(undo(view)).toBe(true)
    }
    expect(undo(view)).toBe(false)
  })

  it('toggles quote, ordered-list, and unordered-list shortcuts on only the active line', () => {
    const content = ['Before', 'Plain paragraph', 'After'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    const selectActiveLine = () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 6 } })
    }

    selectActiveLine()
    dispatchEditorShortcut(view, { key: 'Q', code: 'KeyQ', keyCode: 81, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(['Before', '> Plain paragraph', 'After'].join('\n'))

    selectActiveLine()
    dispatchEditorShortcut(view, { key: 'Q', code: 'KeyQ', keyCode: 81, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(content)

    selectActiveLine()
    dispatchEditorShortcut(view, { key: '{', code: 'BracketLeft', keyCode: 219, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(['Before', '1. Plain paragraph', 'After'].join('\n'))

    selectActiveLine()
    dispatchEditorShortcut(view, { key: '{', code: 'BracketLeft', keyCode: 219, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(content)

    selectActiveLine()
    dispatchEditorShortcut(view, { key: '}', code: 'BracketRight', keyCode: 221, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(['Before', '- Plain paragraph', 'After'].join('\n'))

    selectActiveLine()
    dispatchEditorShortcut(view, { key: '}', code: 'BracketRight', keyCode: 221, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe(content)
  })

  it('converts quote and list lines back to plain paragraphs with Cmd/Ctrl+0', () => {
    const content = ['> Quoted line', '1. Ordered line', '- Bullet line'].join('\n')
    const { container } = render(
      <MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)

    view.dispatch({ selection: { anchor: view.state.doc.line(1).from + 4 } })
    fireEvent.keyDown(view.contentDOM, { key: '0', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Quoted line', '1. Ordered line', '- Bullet line'].join('\n'))

    view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 4 } })
    fireEvent.keyDown(view.contentDOM, { key: '0', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Quoted line', 'Ordered line', '- Bullet line'].join('\n'))

    view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 4 } })
    fireEvent.keyDown(view.contentDOM, { key: '0', ctrlKey: true })
    expect(view.state.doc.toString()).toBe(['Quoted line', 'Ordered line', 'Bullet line'].join('\n'))
  })

  it('keeps Enter-driven list continuation working after converting a paragraph into a list item', () => {
    const { container } = render(
      <MarkFlowEditor content="Plain paragraph" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: 6 } })

    dispatchEditorShortcut(view, { key: '}', code: 'BracketRight', keyCode: 221, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe('- Plain paragraph')

    view.dispatch({ selection: { anchor: view.state.doc.length } })
    fireEvent.keyDown(view.contentDOM, { key: 'Enter' })

    expect(view.state.doc.toString()).toBe('- Plain paragraph\n- ')
  })

  it('does not rewrite existing task list lines when paragraph shortcuts run', () => {
    const { container } = render(
      <MarkFlowEditor content="- [ ] Task item" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: 6 } })

    dispatchEditorShortcut(view, { key: '}', code: 'BracketRight', keyCode: 221, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe('- [ ] Task item')

    dispatchEditorShortcut(view, { key: 'Q', code: 'KeyQ', keyCode: 81, ctrlKey: true, shiftKey: true })
    expect(view.state.doc.toString()).toBe('- [ ] Task item')
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

  it('resolves internal anchors through the symbol table lookup on Cmd/Ctrl+Click', async () => {
    const content = ['Intro [Jump](#details)', '', '# Details'].join('\n')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const headingSpy = vi.spyOn(outline, 'findHeadingAnchorPosition')
    const { container } = render(<MarkFlowEditor content={content} viewMode="wysiwyg" onChange={vi.fn()} />)

    const view = getEditorView(container)
    await waitFor(() => {
      expect(view.state.field(symbolTableField).anchors.get('details')).toBe(content.indexOf('# Details'))
    })

    const link = container.querySelector('a.mf-link')
    expect(link).not.toBeNull()

    headingSpy.mockClear()
    fireEvent.click(link as Element, { ctrlKey: true })

    expect(headingSpy).toHaveBeenCalledTimes(1)
    expect(headingSpy.mock.calls[0]?.[0]).toBe(content)
    expect(headingSpy.mock.calls[0]?.[1]).toBe('#details')
    expect(headingSpy.mock.calls[0]?.[2]).toBe(view.state.field(symbolTableField).anchors)
    expect(view.state.selection.main.head).toBe(content.indexOf('# Details'))
    expect(openSpy).not.toHaveBeenCalled()

    headingSpy.mockRestore()
    openSpy.mockRestore()
  })

  it('wraps selected text with bold using Mod-b shortcut', () => {
    const { container: c1 } = render(
      <MarkFlowEditor content="Hello world" viewMode="wysiwyg" onChange={vi.fn()} />,
    )
    const v1 = getEditorView(c1)
    v1.dispatch({ selection: { anchor: 6, head: 11 } })
    fireEvent.keyDown(v1.contentDOM, { key: 'b', ctrlKey: true })
    expect(v1.state.doc.toString()).toBe('Hello **world**')
  })

  it('wraps selected text with link using Mod-k shortcut', () => {
    const { container: c2 } = render(
      <MarkFlowEditor content="Click here" viewMode="wysiwyg" onChange={vi.fn()} />,
    )
    const v2 = getEditorView(c2)
    v2.dispatch({ selection: { anchor: 6, head: 10 } })
    fireEvent.keyDown(v2.contentDOM, { key: 'k', ctrlKey: true })
    expect(v2.state.doc.toString()).toBe('Click [here](url)')
  })

  it('inserts bold wrapper with placeholder when no selection', () => {
    const { container } = render(
      <MarkFlowEditor content="Hello world" viewMode="wysiwyg" onChange={vi.fn()} />,
    )
    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: 6 } })
    fireEvent.keyDown(view.contentDOM, { key: 'b', ctrlKey: true })
    expect(view.state.doc.toString()).toBe('Hello **bold text**world')
    expect(view.state.selection.main.from).toBe(8)
  })

  it('inserts link placeholder with collapsed selection using Mod-k', () => {
    const { container } = render(
      <MarkFlowEditor content="Hello" viewMode="wysiwyg" onChange={vi.fn()} />,
    )
    const view = getEditorView(container)
    view.dispatch({ selection: { anchor: 5 } })
    fireEvent.keyDown(view.contentDOM, { key: 'k', ctrlKey: true })
    expect(view.state.doc.toString()).toBe('Hello[link text](url)')
    expect(view.state.selection.main.from).toBe(6)
    expect(view.state.selection.main.to).toBe(14)
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
