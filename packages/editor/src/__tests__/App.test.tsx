import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import type {
  MarkFlowDesktopAPI,
  MarkFlowFilePayload,
  MarkFlowMenuAction,
  MarkFlowMenuActionPayload,
  MarkFlowSavePayload,
} from '@markflow/shared'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

class MockMarkFlowAPI implements MarkFlowDesktopAPI {
  openFile: MarkFlowDesktopAPI['openFile'] = vi.fn(async () => null)
  saveFile: MarkFlowDesktopAPI['saveFile'] = vi.fn(async () => ({ success: true }))
  saveFileAs: MarkFlowDesktopAPI['saveFileAs'] = vi.fn(async () => ({ success: true }))
  newFile: MarkFlowDesktopAPI['newFile'] = vi.fn(async () => {})
  getCurrentPath: MarkFlowDesktopAPI['getCurrentPath'] = vi.fn(async () => null)
  getCurrentDocument: MarkFlowDesktopAPI['getCurrentDocument'] = vi.fn(async () => null)

  private fileOpenedListeners = new Set<(data: MarkFlowFilePayload) => void>()
  private fileSavedListeners = new Set<(data: MarkFlowSavePayload) => void>()
  private menuActionListeners = new Set<(data: MarkFlowMenuActionPayload) => void>()

  onFileOpened(cb: (data: MarkFlowFilePayload) => void) {
    this.fileOpenedListeners.add(cb)
    return () => this.fileOpenedListeners.delete(cb)
  }

  onFileSaved(cb: (data: MarkFlowSavePayload) => void) {
    this.fileSavedListeners.add(cb)
    return () => this.fileSavedListeners.delete(cb)
  }

  onMenuAction(cb: (data: MarkFlowMenuActionPayload) => void) {
    this.menuActionListeners.add(cb)
    return () => this.menuActionListeners.delete(cb)
  }

  emitFileOpened(data: MarkFlowFilePayload) {
    for (const listener of this.fileOpenedListeners) listener(data)
  }

  emitFileSaved(data: MarkFlowSavePayload) {
    for (const listener of this.fileSavedListeners) listener(data)
  }

  emitMenuAction(action: MarkFlowMenuAction) {
    for (const listener of this.menuActionListeners) listener({ action })
  }
}

describe('App desktop integration', () => {
  afterEach(() => {
    delete window.markflow
  })

  it('hydrates an already-open desktop document on mount', async () => {
    const api = new MockMarkFlowAPI()
    api.getCurrentDocument = vi.fn(async () => ({
      filePath: '/tmp/session.md',
      content: '# Session restore',
    }))
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe('# Session restore')
    })

    expect(screen.getByText('session.md')).toBeInTheDocument()
  })

  it('loads opened files and saves the live editor buffer through menu actions', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/notes.md', content: '# Notes' })
    })

    const view = getEditorView(container)
    expect(view.state.doc.toString()).toBe('# Notes')
    expect(screen.getByText('notes.md')).toBeInTheDocument()

    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nSecond line' },
      })
    })

    expect(screen.getByText('notes.md • Unsaved')).toBeInTheDocument()

    await act(async () => {
      api.emitMenuAction('save-file')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('# Notes\nSecond line')
    })

    await act(async () => {
      api.emitFileSaved({ filePath: '/tmp/notes.md' })
    })

    expect(screen.getByText('notes.md')).toBeInTheDocument()
  })

  it('routes new and open menu actions back through the desktop bridge', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    expect(screen.getByText('Starter Document')).toBeInTheDocument()

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/draft.md', content: 'Draft' })
    })

    const view = getEditorView(container)
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: ' update' },
      })
    })

    expect(screen.getByText('draft.md • Unsaved')).toBeInTheDocument()

    await act(async () => {
      api.emitMenuAction('new-file')
      api.emitMenuAction('open-file')
      api.emitMenuAction('save-file-as')
    })

    expect(api.newFile).toHaveBeenCalledTimes(1)
    expect(api.openFile).toHaveBeenCalledTimes(1)
    expect(api.saveFileAs).toHaveBeenCalledTimes(1)

    await act(async () => {
      api.emitFileOpened({ filePath: null, content: '' })
    })

    expect(screen.getByText('Untitled')).toBeInTheDocument()
    expect(getEditorView(container).state.doc.toString()).toBe('')
    expect(screen.queryByText(/Unsaved/)).not.toBeInTheDocument()
  })

  it('wires editor shortcut toggling and document filePath-based image resolution through App', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/Users/pprp/docs/note.md',
        content: 'Intro\n\n![Diagram](./assets/diagram.png)',
      })
    })

    const view = getEditorView(container)

    await waitFor(() => {
      const image = container.querySelector('img.mf-image-widget')
      expect(image).toHaveAttribute('src', 'file:///Users/pprp/docs/assets/diagram.png')
    })

    fireEvent.keyDown(view.contentDOM, { key: '/', ctrlKey: true })

    await waitFor(() => {
      expect(container.querySelector('.mf-mode-toggle')).toHaveTextContent('Source')
    })
  })
})
