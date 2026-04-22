import { EditorSelection, EditorState } from '@codemirror/state'
import { undo } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { foldEffect, foldedRanges } from '@codemirror/language'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import * as React from 'react'
import { act } from 'react'
import * as path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, RECOVERY_CHECKPOINT_SYNC_DELAY_MS } from '../App'
import { headingFoldExtension } from '../editor/extensions/headingFold'
import {
  LARGE_DOCUMENT_CONTENT_SYNC_DELAY_MS,
  LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS,
} from '../largeDocument'
import {
  HEADING_NUMBERING_ATTRIBUTE,
  HEADING_NUMBERING_OUTLINE_LEVEL_ATTRIBUTE,
  HEADING_NUMBERING_STYLE_ELEMENT_ID,
  loadLocalHeadingNumberingPreference,
  persistLocalHeadingNumberingPreference,
} from '../headingNumbering'
import {
  loadLocalSourceLineNumbersPreference,
  persistLocalSourceLineNumbersPreference,
} from '../sourceLineNumbers'
import {
  OUTLINE_PANEL_STORAGE_KEY,
  persistLocalOutlinePanelCollapsedPreference,
} from '../outlinePanelPreferences'
import {
  loadLocalStatisticsPreferences,
  persistLocalStatisticsPreferences,
} from '../statisticsPreferences'
import {
  loadLocalMarkdownModePreference,
  persistLocalMarkdownModePreference,
} from '../markdownMode'
import { computeStats } from '../editor/wordCount'
import type {
  MarkFlowDesktopAPI,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowImageUploadResult,
  MarkFlowImageUploadSettings,
  MarkFlowMenuAction,
  MarkFlowMenuActionPayload,
  MarkFlowRecoveryCheckpoint,
  MarkFlowSavePayload,
  MarkFlowSpellCheckState,
  MarkFlowThemePayload,
  MarkFlowThemeState,
  MarkFlowThemeSummary,
  MarkFlowWindowState,
  MarkFlowWindowSession,
  MarkFlowWindowSessionState,
} from '@markflow/shared'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

function getCollapsedRanges(view: EditorView) {
  const ranges: number[] = []
  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
    ranges.push(from, to)
  })
  return ranges
}

function getVisibleLineNumbers(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.cm-lineNumbers .cm-gutterElement'))
    .filter((element) => !element.getAttribute('style')?.includes('visibility: hidden'))
    .map((element) => element.textContent)
}

function getStatisticsRow(panel: HTMLElement, label: string) {
  const rowHeader = within(panel).getByRole('rowheader', { name: label })
  const row = rowHeader.closest('tr')
  expect(row).not.toBeNull()
  return row as HTMLTableRowElement
}

function getOpenTabs() {
  return screen.getAllByRole('tab')
}

function expectActiveDocumentName(name: string | RegExp) {
  return screen.getByText(name, { selector: '.mf-titlebar-document-name' })
}

let restoreTestLocalStorage: (() => void) | null = null

function installTestLocalStorage(initialEntries: Record<string, string> = {}) {
  restoreTestLocalStorage?.()

  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  const store = new Map(Object.entries(initialEntries))
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value))
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  } as unknown as Storage

  restoreTestLocalStorage = () => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor)
    } else {
      delete (window as unknown as { localStorage?: Storage }).localStorage
    }
    restoreTestLocalStorage = null
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })

  return storage as Storage
}

function buildWindowedPayload(
  filePath: string,
  windowStartLine: number,
  windowEndLine: number,
  anchorLine: number,
  totalLines: number = 1_500_000,
): MarkFlowFilePayload {
  const lines: string[] = []
  for (let lineNumber = windowStartLine; lineNumber <= windowEndLine; lineNumber += 1) {
    lines.push(`Line ${lineNumber}`)
  }

  return {
    filePath,
    content: lines.join('\n'),
    largeFile: {
      totalBytes: 2 * 1024 * 1024 * 1024,
      totalLines,
      windowStartLine,
      windowEndLine,
      anchorLine,
      readOnly: true,
    },
  }
}

interface MockStartupState {
  document: MarkFlowFilePayload | null
  folderPath: string | null
  windowSession: MarkFlowWindowSession | null
}

class MockMarkFlowAPI implements MarkFlowDesktopAPI {
  private documents = new Map<string, MarkFlowFilePayload>()
  private themes: MarkFlowThemeSummary[] = [
    { id: 'paper', name: 'Paper' },
    { id: 'github', name: 'GitHub' },
    { id: 'midnight', name: 'Midnight' },
    { id: 'night', name: 'Night' },
  ]
  private themeState: MarkFlowThemeState = {
    activeAppearance: 'light',
    appearancePreference: 'system',
    lightThemeId: 'paper',
    darkThemeId: 'paper',
    activeTheme: {
      id: 'paper',
      name: 'Paper',
      cssText: ':root { --mf-accent: #9c5f2f; }',
    },
  }
  private spellCheckState: MarkFlowSpellCheckState = {
    selectedLanguage: null,
    availableLanguages: ['de-DE', 'en-US', 'fr-FR'],
    customWords: [],
  }
  private imageUploadSettings: MarkFlowImageUploadSettings = {
    autoUploadOnInsert: false,
    uploaderKind: 'disabled',
    command: 'picgo',
    arguments: 'upload',
    timeoutMs: 5_000,
    assetDirectoryName: 'assets',
    keepLocalCopyAfterUpload: true,
  }
  private nextImageUploadResult: MarkFlowImageUploadResult = {
    success: true,
    remoteUrl: 'https://cdn.example.com/diagram.png',
  }
  private windowState: MarkFlowWindowState = {
    isAlwaysOnTop: false,
    isFullscreen: false,
  }
  private startupState: MockStartupState = {
    document: null,
    folderPath: null,
    windowSession: null,
  }
  private windowSession: MarkFlowWindowSession | null = null
  private confirmTabCloseAction: 'save' | 'discard' | 'cancel' = 'cancel'
  openFile: MarkFlowDesktopAPI['openFile'] = vi.fn(async () => null)
  openPath: MarkFlowDesktopAPI['openPath'] = vi.fn(async (filePath: string) => {
    const document = this.documents.get(filePath) ?? null
    if (document) {
      this.emitFileOpened(document)
    }
    return document
  })
  getStartupState = vi.fn(async () => this.startupState)
  readLargeFileWindow: MarkFlowDesktopAPI['readLargeFileWindow'] = vi.fn(async () => null)
  saveFile: MarkFlowDesktopAPI['saveFile'] = vi.fn(async () => ({ success: true }))
  saveFileAs: MarkFlowDesktopAPI['saveFileAs'] = vi.fn(async () => ({ success: true }))
  getFoldState: MarkFlowDesktopAPI['getFoldState'] = vi.fn(async () => [])
  saveFoldState: MarkFlowDesktopAPI['saveFoldState'] = vi.fn(async () => {})
  scheduleRecoveryCheckpoint: MarkFlowDesktopAPI['scheduleRecoveryCheckpoint'] = vi.fn(() => {})
  getRecoveryCheckpoint: MarkFlowDesktopAPI['getRecoveryCheckpoint'] = vi.fn(async () => null)
  discardRecoveryCheckpoint: MarkFlowDesktopAPI['discardRecoveryCheckpoint'] = vi.fn(async () => {})
  newFile: MarkFlowDesktopAPI['newFile'] = vi.fn(async () => {})
  getCurrentPath: MarkFlowDesktopAPI['getCurrentPath'] = vi.fn(async () => null)
  getQuickOpenList: MarkFlowDesktopAPI['getQuickOpenList'] = vi.fn(async () => [])
  getCurrentDocument: MarkFlowDesktopAPI['getCurrentDocument'] = vi.fn(async () => null)
  getWindowSession: MarkFlowDesktopAPI['getWindowSession'] = vi.fn(async () => this.windowSession)
  getWindowState: MarkFlowDesktopAPI['getWindowState'] = vi.fn(async () => this.windowState)
  saveWindowSession: MarkFlowDesktopAPI['saveWindowSession'] = vi.fn(async (session: MarkFlowWindowSessionState) => {
    this.windowSession = {
      documents: session.filePaths.map((filePath) => ({ filePath, content: '' })),
      activeFilePath: session.activeFilePath,
    }
  })
  confirmTabClose: MarkFlowDesktopAPI['confirmTabClose'] = vi.fn(async () => this.confirmTabCloseAction)

  exportHtml: MarkFlowDesktopAPI['exportHtml'] = vi.fn(async () => true)
  exportPdf: MarkFlowDesktopAPI['exportPdf'] = vi.fn(async () => true)
  exportDocx: MarkFlowDesktopAPI['exportDocx'] = vi.fn(async () => true)
  exportEpub: MarkFlowDesktopAPI['exportEpub'] = vi.fn(async () => true)
  exportLatex: MarkFlowDesktopAPI['exportLatex'] = vi.fn(async () => true)
  openFolder: MarkFlowDesktopAPI['openFolder'] = vi.fn(async () => null)
  openFolderPath: MarkFlowDesktopAPI['openFolderPath'] = vi.fn(async () => null)
  getVaultFiles: MarkFlowDesktopAPI['getVaultFiles'] = vi.fn(async () => [])
  renameFile: MarkFlowDesktopAPI['renameFile'] = vi.fn(async () => {})
  deleteFile: MarkFlowDesktopAPI['deleteFile'] = vi.fn(async () => {})
  searchFiles: MarkFlowDesktopAPI['searchFiles'] = vi.fn(async () => [])
  writeClipboard: MarkFlowDesktopAPI['writeClipboard'] = vi.fn(async () => {})
  getImageUploadSettings: MarkFlowDesktopAPI['getImageUploadSettings'] = vi.fn(
    async () => this.imageUploadSettings,
  )
  setImageUploadSettings: MarkFlowDesktopAPI['setImageUploadSettings'] = vi.fn(
    async (settings: MarkFlowImageUploadSettings) => {
      this.imageUploadSettings = settings
      return this.imageUploadSettings
    },
  )
  ingestImage: MarkFlowDesktopAPI['ingestImage'] = vi.fn(async (request) => {
    const baseDirectory = request.documentFilePath
      ? path.join(path.dirname(request.documentFilePath), this.imageUploadSettings.assetDirectoryName)
      : path.join('/tmp', 'markflow-staged')
    const localFilePath = path.join(baseDirectory, request.fileName)
    const markdownSource = request.documentFilePath
      ? `./${this.imageUploadSettings.assetDirectoryName}/${request.fileName}`
      : localFilePath

    return {
      localFilePath,
      markdownSource,
    }
  })
  uploadImage: MarkFlowDesktopAPI['uploadImage'] = vi.fn(async () => this.nextImageUploadResult)

  getThemes: MarkFlowDesktopAPI['getThemes'] = vi.fn(async () => this.themes)
  getThemeState: MarkFlowDesktopAPI['getThemeState'] = vi.fn(async () => this.themeState)
  getCurrentTheme: MarkFlowDesktopAPI['getCurrentTheme'] = vi.fn(async () => this.themeState.activeTheme)
  setTheme: MarkFlowDesktopAPI['setTheme'] = vi.fn(async (themeId: string) => {
    const theme = this.buildThemePayload(themeId)
    if (!theme) {
      return null
    }

    const nextState: MarkFlowThemeState = {
      activeAppearance: this.themeState.activeAppearance,
      appearancePreference: this.themeState.appearancePreference,
      lightThemeId: this.themeState.lightThemeId,
      darkThemeId: this.themeState.darkThemeId,
      activeTheme: theme,
    }
    this.emitThemeUpdated(nextState)
    return theme
  })
  setThemeForAppearance: MarkFlowDesktopAPI['setThemeForAppearance'] = vi.fn(
    async (appearance, themeId: string) => {
      const theme = this.buildThemePayload(themeId)
      if (!theme) {
        return null
      }

      const nextState: MarkFlowThemeState = {
        ...this.themeState,
        activeAppearance: appearance,
        activeTheme: theme,
        lightThemeId: appearance === 'light' ? themeId : this.themeState.lightThemeId,
        darkThemeId: appearance === 'dark' ? themeId : this.themeState.darkThemeId,
      }
      this.emitThemeUpdated(nextState)
      return nextState
    },
  )
  setThemeAppearancePreference: MarkFlowDesktopAPI['setThemeAppearancePreference'] = vi.fn(
    async (preference) => {
      const nextState: MarkFlowThemeState = {
        ...this.themeState,
        appearancePreference: preference,
      }
      this.emitThemeUpdated(nextState)
      return nextState
    },
  )
  getSpellCheckState: MarkFlowDesktopAPI['getSpellCheckState'] = vi.fn(async () => this.spellCheckState)
  setSpellCheckLanguage: MarkFlowDesktopAPI['setSpellCheckLanguage'] = vi.fn(async (language: string | null) => {
    const nextLanguage =
      language && this.spellCheckState.availableLanguages.includes(language) ? language : null

    this.spellCheckState = {
      ...this.spellCheckState,
      selectedLanguage: nextLanguage,
    }

    return this.spellCheckState
  })
  addSpellCheckWord: MarkFlowDesktopAPI['addSpellCheckWord'] = vi.fn(async (word: string) => {
    const normalized = word.trim()
    if (normalized.length === 0) {
      return this.spellCheckState
    }

    const existingWord = this.spellCheckState.customWords.find(
      (currentWord) => currentWord.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    )
    if (existingWord) {
      return this.spellCheckState
    }

    this.spellCheckState = {
      ...this.spellCheckState,
      customWords: [...this.spellCheckState.customWords, normalized].sort((left, right) =>
        left.localeCompare(right),
      ),
    }

    return this.spellCheckState
  })
  removeSpellCheckWord: MarkFlowDesktopAPI['removeSpellCheckWord'] = vi.fn(async (word: string) => {
    this.spellCheckState = {
      ...this.spellCheckState,
      customWords: this.spellCheckState.customWords.filter((currentWord) => currentWord !== word),
    }

    return this.spellCheckState
  })

  private fileOpenedListeners = new Set<(data: MarkFlowFilePayload) => void>()
  private fileLoadingProgressListeners = new Set<(data: MarkFlowFileLoadProgressPayload) => void>()
  private fileSavedListeners = new Set<(data: MarkFlowSavePayload) => void>()
  private menuActionListeners = new Set<(data: MarkFlowMenuActionPayload) => void>()
  private windowStateChangedListeners = new Set<(data: MarkFlowWindowState) => void>()
  private themeUpdatedListeners = new Set<(data: MarkFlowThemeState) => void>()

  private buildThemePayload(themeId: string): MarkFlowThemePayload | null {
    if (themeId === 'paper') {
      return {
        id: 'paper',
        name: 'Paper',
        cssText: ':root { --mf-accent: #9c5f2f; }',
      }
    }

    if (themeId === 'midnight') {
      return {
        id: 'midnight',
        name: 'Midnight',
        cssText: ':root { --mf-bg: #111827; }',
      }
    }

    if (themeId === 'github') {
      return {
        id: 'github',
        name: 'GitHub',
        cssText: ':root { --mf-accent: #0366d6; }',
      }
    }

    if (themeId === 'night') {
      return {
        id: 'night',
        name: 'Night',
        cssText: ':root { --mf-bg: #1d1f21; }',
      }
    }

    return null
  }

  setWindowSession(session: MarkFlowWindowSession | null) {
    this.windowSession = session
    this.startupState = {
      ...this.startupState,
      document: null,
      windowSession: session,
    }
  }

  setStartupState(startupState: MockStartupState) {
    this.startupState = startupState
  }

  setDocument(document: MarkFlowFilePayload) {
    if (document.filePath) {
      this.documents.set(document.filePath, document)
    }
  }

  setConfirmTabCloseAction(action: 'save' | 'discard' | 'cancel') {
    this.confirmTabCloseAction = action
  }

  setImageUploadSettingsState(settings: MarkFlowImageUploadSettings) {
    this.imageUploadSettings = settings
  }

  setNextImageUploadResult(result: MarkFlowImageUploadResult) {
    this.nextImageUploadResult = result
  }

  onFileOpened(cb: (data: MarkFlowFilePayload) => void) {
    this.fileOpenedListeners.add(cb)
    return () => this.fileOpenedListeners.delete(cb)
  }

  onFileLoadingProgress(cb: (data: MarkFlowFileLoadProgressPayload) => void) {
    this.fileLoadingProgressListeners.add(cb)
    return () => this.fileLoadingProgressListeners.delete(cb)
  }

  onFileSaved(cb: (data: MarkFlowSavePayload) => void) {
    this.fileSavedListeners.add(cb)
    return () => this.fileSavedListeners.delete(cb)
  }

  onMenuAction(cb: (data: MarkFlowMenuActionPayload) => void) {
    this.menuActionListeners.add(cb)
    return () => this.menuActionListeners.delete(cb)
  }

  onWindowStateChanged(cb: (data: MarkFlowWindowState) => void) {
    this.windowStateChangedListeners.add(cb)
    return () => this.windowStateChangedListeners.delete(cb)
  }

  onThemeUpdated(cb: (data: MarkFlowThemeState) => void) {
    this.themeUpdatedListeners.add(cb)
    return () => this.themeUpdatedListeners.delete(cb)
  }

  emitFileOpened(data: MarkFlowFilePayload) {
    if (data.filePath) {
      this.documents.set(data.filePath, data)
    }
    for (const listener of this.fileOpenedListeners) listener(data)
  }

  emitFileLoadingProgress(data: MarkFlowFileLoadProgressPayload) {
    for (const listener of this.fileLoadingProgressListeners) listener(data)
  }

  emitFileSaved(data: MarkFlowSavePayload) {
    for (const listener of this.fileSavedListeners) listener(data)
  }

  emitMenuAction(action: MarkFlowMenuAction, path?: string | null) {
    for (const listener of this.menuActionListeners) listener({ action, path })
  }

  emitWindowStateChanged(data: MarkFlowWindowState) {
    this.windowState = data
    for (const listener of this.windowStateChangedListeners) listener(data)
  }

  emitThemeUpdated(data: MarkFlowThemeState) {
    this.themeState = data
    for (const listener of this.themeUpdatedListeners) listener(data)
  }
}

describe('App desktop integration', () => {
  afterEach(() => {
    vi.useRealTimers()
    delete window.markflow
    persistLocalMarkdownModePreference('tolerant')
    persistLocalHeadingNumberingPreference(false)
    persistLocalSourceLineNumbersPreference(true)
    persistLocalOutlinePanelCollapsedPreference(false)
    persistLocalStatisticsPreferences({ excludeFencedCode: true })
    if (typeof window.localStorage?.removeItem === 'function') {
      window.localStorage.removeItem(OUTLINE_PANEL_STORAGE_KEY)
      window.localStorage.removeItem('markflow.spellcheck-profile.v1')
    }
    restoreTestLocalStorage?.()
  })

  it('hydrates an already-open desktop document on mount', async () => {
    const api = new MockMarkFlowAPI()
    api.setStartupState({
      document: {
        filePath: '/tmp/session.md',
        content: '# Session restore',
      },
      folderPath: null,
      windowSession: null,
    })
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe('# Session restore')
    })

    expect(expectActiveDocumentName('session.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
  })

  it('opens the startup folder returned by the desktop bridge on mount', async () => {
    const api = new MockMarkFlowAPI()
    api.setStartupState({
      document: null,
      folderPath: '/docs',
      windowSession: null,
    })
    api.getVaultFiles = vi.fn(async () => ['/docs/alpha.md', '/docs/beta.md'])
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(container.querySelector('.mf-sidebar')).toBeInTheDocument()
      expect(screen.getByText('alpha.md')).toBeInTheDocument()
      expect(screen.getByText('beta.md')).toBeInTheDocument()
    })
  })

  it('loads the default markdown post-processor plugin for starter links', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      const link = container.querySelector('a.mf-link')
      expect(link).toHaveAttribute('data-mf-link-kind', 'external')
      expect(link).toHaveClass('mf-link-external')
    })
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
    expect(expectActiveDocumentName('notes.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()

    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nSecond line' },
      })
    })

    expect(expectActiveDocumentName('notes.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-titlebar-dirty-dot')).toBeInTheDocument()

    await act(async () => {
      api.emitMenuAction('save-file')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('# Notes\nSecond line', expect.any(String))
    })

    await act(async () => {
      api.emitFileSaved({ filePath: '/tmp/notes.md' })
    })

    expect(expectActiveDocumentName('notes.md')).toBeInTheDocument()
  })

  it('saves the latest large-document editor content before deferred sync flushes', async () => {
    vi.useFakeTimers()
    const api = new MockMarkFlowAPI()
    window.markflow = api
    const content = `# Large\n${'x'.repeat(LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS)}`

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/large.md', content })
    })

    const view = getEditorView(container)
    await act(async () => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nLatest line' },
      })
    })

    await act(async () => {
      api.emitMenuAction('save-file')
      await Promise.resolve()
    })

    const savedContent = vi.mocked(api.saveFile).mock.lastCall?.[0]
    expect(typeof savedContent).toBe('string')
    expect(savedContent?.endsWith('\nLatest line')).toBe(true)
  })

  it('routes Save for an active untitled tab through save-as with the tab content and tab id', async () => {
    const api = new MockMarkFlowAPI()
    api.saveFileAs = vi.fn(async () => ({ success: true, filePath: '/tmp/new-draft.md' }))
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/original.md', content: '# Original' })
    })
    await act(async () => {
      api.emitFileOpened({ filePath: null, content: '' })
    })

    const view = getEditorView(container)
    act(() => {
      view.dispatch({ changes: { from: 0, insert: '# Untitled draft' } })
    })

    await act(async () => {
      api.emitMenuAction('save-file')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(api.saveFileAs).toHaveBeenCalledWith('# Untitled draft', expect.any(String))
    })
    expect(api.saveFile).not.toHaveBeenCalled()
    expect(api.saveWindowSession).toHaveBeenCalledWith({
      filePaths: ['/tmp/original.md'],
      activeFilePath: null,
    })
    expect(expectActiveDocumentName('new-draft.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-titlebar-dirty-dot')).not.toBeInTheDocument()
  })

  it('opens multiple documents in tabs and preserves selection, outline focus, and undo history while cycling', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const alphaContent = '# Alpha\n\n## One'
    const betaContent = '# Beta\n\n## Two'
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/alpha.md', content: alphaContent })
    })

    let view = getEditorView(container)
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nAlpha line' },
        selection: {
          anchor: alphaContent.indexOf('One'),
          head: alphaContent.indexOf('One') + 'One'.length,
        },
      })
    })

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/beta.md', content: betaContent })
    })

    view = getEditorView(container)
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nBeta line' },
      })
    })

    expect(getOpenTabs().map((tab) => tab.textContent)).toEqual(expect.arrayContaining(['alpha.md', 'beta.md']))
    expect(container.querySelectorAll('.mf-tab-dirty-dot')).toHaveLength(2)

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      const alphaView = getEditorView(container)
      expect(alphaView.state.doc.toString()).toBe('# Alpha\n\n## One\nAlpha line')
      expect(alphaView.state.sliceDoc(alphaView.state.selection.main.from, alphaView.state.selection.main.to)).toBe(
        'One',
      )
      expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-current', 'true')
    })

    act(() => {
      const alphaView = getEditorView(container)
      expect(undo(alphaView)).toBe(true)
    })

    expect(getEditorView(container).state.doc.toString()).toBe(alphaContent)

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true })

    await waitFor(() => {
      const betaView = getEditorView(container)
      expect(betaView.state.doc.toString()).toBe('# Beta\n\n## Two\nBeta line')
    })

    act(() => {
      const betaView = getEditorView(container)
      expect(undo(betaView)).toBe(true)
    })

    expect(getEditorView(container).state.doc.toString()).toBe(betaContent)
  })

  it('restores the tab session returned by the desktop bridge on relaunch', async () => {
    const api = new MockMarkFlowAPI()
    api.setWindowSession({
      documents: [
        { filePath: '/tmp/alpha.md', content: '# Alpha' },
        { filePath: '/tmp/beta.md', content: '# Beta' },
      ],
      activeFilePath: '/tmp/beta.md',
    })
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(getOpenTabs()).toHaveLength(2)
      expect(screen.getByRole('tab', { name: 'beta.md' })).toBeInTheDocument()
      expect(getEditorView(container).state.doc.toString()).toBe('# Beta')
    })
  })

  it('reopens the last cleanly closed tab with its prior selection and undo history restored', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/reopen.md', content: '# Reopen' })
    })

    let view = getEditorView(container)
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nSaved line' },
        selection: { anchor: 2, head: 8 },
      })
    })

    await act(async () => {
      api.emitMenuAction('save-file')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('# Reopen\nSaved line', expect.any(String))
      expect(container.querySelector('.mf-titlebar-dirty-dot')).not.toBeInTheDocument()
    })

    await act(async () => {
      api.emitMenuAction('close-tab')
    })

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: 'reopen.md' })).not.toBeInTheDocument()
    })

    fireEvent.keyDown(document, { key: 't', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      const reopenedView = getEditorView(container)
      expect(expectActiveDocumentName('reopen.md')).toBeInTheDocument()
      expect(container.querySelector('.mf-tabstrip')).toBeInTheDocument()
      expect(reopenedView.state.doc.toString()).toBe('# Reopen\nSaved line')
      expect(
        reopenedView.state.sliceDoc(reopenedView.state.selection.main.from, reopenedView.state.selection.main.to),
      ).toBe('Reopen')
    })

    act(() => {
      const reopenedView = getEditorView(container)
      expect(undo(reopenedView)).toBe(true)
    })

    expect(getEditorView(container).state.doc.toString()).toBe('# Reopen')
  })

  it('shows a dirty-close prompt and respects cancel, save, and discard choices', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/cancel.md', content: '# Cancel' })
    })

    act(() => {
      const view = getEditorView(container)
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nDirty' } })
    })

    api.setConfirmTabCloseAction('cancel')
    await act(async () => {
      api.emitMenuAction('close-tab')
    })

    expect(api.confirmTabClose).toHaveBeenCalledWith('cancel.md')
    expect(expectActiveDocumentName('cancel.md')).toBeInTheDocument()
    expect(api.saveFile).not.toHaveBeenCalled()

    api.setConfirmTabCloseAction('save')
    await act(async () => {
      api.emitMenuAction('close-tab')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('# Cancel\nDirty', expect.any(String))
      expect(expectActiveDocumentName(/Starter Document|Untitled/)).toBeInTheDocument()
    })

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/discard.md', content: '# Discard' })
    })

    act(() => {
      const view = getEditorView(container)
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nDirty' } })
    })

    api.setConfirmTabCloseAction('discard')
    await act(async () => {
      api.emitMenuAction('close-tab')
    })

    await waitFor(() => {
      expect(expectActiveDocumentName(/Starter Document|Untitled/)).toBeInTheDocument()
    })

    expect(api.saveFile).toHaveBeenCalledTimes(1)
  })

  it('shows streamed large-file progress until the final document arrives', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileLoadingProgress({
        filePath: '/tmp/huge.md',
        bytesRead: 65536,
        totalBytes: 262144,
        previewContent: '# Huge file\n\nFirst screen of content',
        done: false,
      })
    })

    expect(screen.getByText('huge.md')).toBeInTheDocument()
    expect(screen.getByText('Opening large file')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Large file loading progress' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    )
    expect(container.querySelector('.mf-file-loading-preview')?.textContent).toContain(
      '# Huge file\n\nFirst screen of content',
    )

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/huge.md', content: '# Huge file\n\nCompleted document' })
    })

    await waitFor(() => {
      expect(screen.queryByText('Opening large file')).not.toBeInTheDocument()
      expect(getEditorView(container).state.doc.toString()).toBe('# Huge file\n\nCompleted document')
    })
  })

  it('routes new and open menu actions back through the desktop bridge', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    expect(expectActiveDocumentName('Starter Document')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/draft.md', content: 'Draft' })
    })

    const view = getEditorView(container)
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: ' update' },
      })
    })

    expect(expectActiveDocumentName('draft.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
    expect(container.querySelector('.mf-titlebar-dirty-dot')).toBeInTheDocument()

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

    expect(expectActiveDocumentName(/Untitled/)).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).toBeInTheDocument()
    expect(getEditorView(container).state.doc.toString()).toBe('')
    expect(container.querySelector('.mf-titlebar-dirty-dot')).not.toBeInTheDocument()
  })

  it('renders a quieter titlebar by demoting secondary writing modes to icon controls', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    const titlebar = await waitFor(() => {
      const element = container.querySelector('.mf-titlebar')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })

    expect(expectActiveDocumentName('Starter Document')).toBeInTheDocument()
    expect(titlebar.querySelector('.mf-titlebar-center-logo')).not.toBeInTheDocument()
    const titlebarLeft = titlebar.querySelector('.mf-titlebar-left')
    const titlebarRight = titlebar.querySelector('.mf-titlebar-right')

    expect(titlebarLeft).not.toBeNull()
    expect(titlebarRight).not.toBeNull()
    expect(within(titlebar).getByRole('button', { name: 'Typewriter mode' })).toBeInTheDocument()
    expect(within(titlebar).getByRole('button', { name: 'Focus mode' })).toBeInTheDocument()
    expect(within(titlebar).queryByText(/^Typewriter$/)).not.toBeInTheDocument()
    expect(within(titlebar).queryByText(/^Focus$/)).not.toBeInTheDocument()
    expect(within(titlebarLeft as HTMLElement).getByRole('button', { name: 'Toggle file sidebar' })).toBeInTheDocument()

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/titlebar-outline.md',
        content: '# Intro\n\n## Details\n\nBody',
      })
    })

    await waitFor(() => {
      expect(within(titlebarRight as HTMLElement).getByRole('button', { name: 'Collapse outline' })).toBeInTheDocument()
    })
  })

  it('hides the titlebar outline toggle when the sidebar already shows the outline', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/sidebar-outline-toggle.md',
        content: '# Intro\n\n## Details\n\nBody',
      })
    })

    const titlebar = await waitFor(() => {
      const element = container.querySelector('.mf-titlebar')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })
    const titlebarRight = titlebar.querySelector('.mf-titlebar-right')
    expect(titlebarRight).not.toBeNull()

    fireEvent.click(within(titlebar).getByRole('button', { name: 'Toggle file sidebar' }))

    const sidebar = await waitFor(() => {
      const element = container.querySelector('.mf-sidebar')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })

    await waitFor(() => {
      expect(
        within(sidebar).getByText('Outline', { selector: '.mf-vault-section-header span' }),
      ).toBeInTheDocument()
      expect(within(sidebar).getByRole('button', { name: 'Intro' })).toBeInTheDocument()
      expect(within(titlebarRight as HTMLElement).queryByRole('button', { name: 'Collapse outline' })).not.toBeInTheDocument()
    })
  })

  it('restores saved folding state on reopen and persists folding after a save', async () => {
    const api = new MockMarkFlowAPI()
    const content = ['# Heading', 'Body line', '# Next', 'Rest'].join('\n')
    const state = EditorState.create({
      doc: content,
      extensions: [markdown({ base: markdownLanguage }), ...headingFoldExtension()],
    })
    const initialRanges = [state.doc.line(1).to, state.doc.line(2).to]
    const secondHeadingRange = { from: state.doc.line(3).to, to: state.doc.line(4).to }

    api.getFoldState = vi.fn(async (filePath: string) => {
      return filePath === '/tmp/folding.md' ? initialRanges : []
    })
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/folding.md', content })
    })

    const view = getEditorView(container)

    await waitFor(() => {
      expect(api.getFoldState).toHaveBeenCalledWith('/tmp/folding.md')
      expect(getCollapsedRanges(view)).toEqual(initialRanges)
    })

    act(() => {
      view.dispatch({
        effects: foldEffect.of(secondHeadingRange),
      })
    })

    await waitFor(() => {
      expect(getCollapsedRanges(view)).toEqual([
        ...initialRanges,
        secondHeadingRange.from,
        secondHeadingRange.to,
      ])
    })

    await act(async () => {
      api.emitMenuAction('save-file')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith(content, expect.any(String))
    })

    await act(async () => {
      api.emitFileSaved({ filePath: '/tmp/folding.md' })
    })

    await waitFor(() => {
      expect(api.saveFoldState).toHaveBeenCalledWith('/tmp/folding.md', [
        ...initialRanges,
        secondHeadingRange.from,
        secondHeadingRange.to,
      ])
    })
  })

  it('writes rich and source clipboard variants for the current selection', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = 'Before **bold** [link](https://example.com) and `code`'
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/copy.md', content })
    })

    const view = getEditorView(container)

    act(() => {
      view.dispatch({
        selection: { anchor: 0, head: content.length },
      })
    })

    view.contentDOM.focus()

    await waitFor(() => {
      expect(screen.getByText(/sel: 4w \/ 54c/)).toBeInTheDocument()
    })

    await act(async () => {
      api.emitMenuAction('copy')
    })

    await waitFor(() => {
      expect(api.writeClipboard).toHaveBeenNthCalledWith(1, {
        html: '<p>Before <strong>bold</strong> <a href="https://example.com">link</a> and <code>code</code></p>',
        text: 'Before bold link and code',
      })
    })

    await act(async () => {
      api.emitMenuAction('copy-as-markdown')
      api.emitMenuAction('copy-as-html-code')
    })

    await waitFor(() => {
      expect(api.writeClipboard).toHaveBeenNthCalledWith(2, {
        text: content,
      })
      expect(api.writeClipboard).toHaveBeenNthCalledWith(3, {
        text: '<p>Before <strong>bold</strong> <a href="https://example.com">link</a> and <code>code</code></p>',
      })
    })
  })

  it('falls back to native copy when a non-editor input is focused', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const originalExecCommand = document.execCommand
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    try {
      const content = 'Before **bold** [link](https://example.com) and `code`'
      const { container } = render(<App />)

      await act(async () => {
        api.emitFileOpened({ filePath: '/tmp/copy.md', content })
      })

      const view = getEditorView(container)

      act(() => {
        view.dispatch({
          selection: { anchor: 0, head: content.length },
        })
      })

      fireEvent.keyDown(document, { key: 'l', ctrlKey: true })

      const lineInput = (await screen.findByLabelText('Line number')) as HTMLInputElement
      await waitFor(() => {
        expect(lineInput).toHaveFocus()
      })

      lineInput.focus()
      lineInput.select()

      await act(async () => {
        api.emitMenuAction('copy')
      })

      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(api.writeClipboard).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      })
    }
  })

  it('does not use stale editor selection for source copy actions outside the editor', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const originalExecCommand = document.execCommand
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    try {
      const content = 'Before **bold** [link](https://example.com) and `code`'
      const { container } = render(<App />)

      await act(async () => {
        api.emitFileOpened({ filePath: '/tmp/copy.md', content })
      })

      const view = getEditorView(container)

      act(() => {
        view.dispatch({
          selection: { anchor: 0, head: content.length },
        })
      })

      fireEvent.keyDown(document, { key: 'l', ctrlKey: true })

      const lineInput = (await screen.findByLabelText('Line number')) as HTMLInputElement
      await waitFor(() => {
        expect(lineInput).toHaveFocus()
      })

      await act(async () => {
        api.emitMenuAction('copy-as-markdown')
        api.emitMenuAction('copy-as-html-code')
      })

      expect(api.writeClipboard).not.toHaveBeenCalled()
      expect(execCommand).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: originalExecCommand,
      })
    }
  })

  it('wires editor shortcut toggling and document filePath-based image resolution through App', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Image upload preferences' })).toHaveTextContent(
        'Uploads: Off',
      )
    })

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
      expect(container.querySelector('.mf-segment-btn.mf-segment-active')).toHaveTextContent('Source')
    })
  })

  it('maps Mod+/ to source from reading while preserving the preview/source toggle, split mode, and palette copy', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/view-mode.md', content: '# View modes' })
    })

    fireEvent.keyDown(getEditorView(container).contentDOM, { key: '/', ctrlKey: true })

    await waitFor(() => {
      expect(container.querySelector('.mf-segment-btn.mf-segment-active')).toHaveTextContent('Source')
    })

    fireEvent.keyDown(getEditorView(container).contentDOM, { key: '/', ctrlKey: true })

    await waitFor(() => {
      expect(container.querySelector('.mf-segment-btn.mf-segment-active')).toHaveTextContent('Preview')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reading mode' }))
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })

    const commandInput = await screen.findByPlaceholderText('Search commands...')
    fireEvent.change(commandInput, { target: { value: 'toggle wysiwyg' } })
    expect(screen.getByText('Switch to source mode')).toBeInTheDocument()
    fireEvent.keyDown(commandInput, { key: 'Escape' })

    fireEvent.keyDown(getEditorView(container).contentDOM, { key: '/', ctrlKey: true })

    await waitFor(() => {
      expect(container.querySelector('.mf-segment-btn.mf-segment-active')).toHaveTextContent('Source')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Split view' }))
    fireEvent.keyDown(getEditorView(container).contentDOM, { key: '/', ctrlKey: true })

    await waitFor(() => {
      expect(container.querySelector('.mf-segment-btn.mf-segment-active')).toHaveTextContent('Split')
    })
  })

  it('rewrites pasted image markdown to the uploaded remote URL when auto-upload is enabled', async () => {
    const api = new MockMarkFlowAPI()
    api.setImageUploadSettingsState({
      autoUploadOnInsert: true,
      uploaderKind: 'picgo-core',
      command: 'picgo',
      arguments: 'upload',
      timeoutMs: 5_000,
      assetDirectoryName: 'assets',
      keepLocalCopyAfterUpload: true,
    })
    api.setNextImageUploadResult({
      success: true,
      remoteUrl: 'https://cdn.example.com/diagram.png',
    })
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Image upload preferences' })).toHaveTextContent(
        'Uploads: PicGo',
      )
    })

    await act(async () => {
      api.emitFileOpened({
        filePath: '/Users/pprp/docs/note.md',
        content: 'Intro',
      })
    })

    const view = getEditorView(container)
    const placeholder = '\n\n![image](./diagram.png)'
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: placeholder },
        selection: { anchor: view.state.doc.length + placeholder.length },
      })
    })

    const imageFile = new File(['image'], 'diagram.png', { type: 'image/png' })

    await act(async () => {
      view.dom.dispatchEvent(
        new CustomEvent('mf-image-paste', {
          detail: {
            file: imageFile,
            markdownText: '![image](./diagram.png)',
            occurrenceIndex: 0,
          },
          bubbles: true,
          composed: true,
        }),
      )
    })

    await waitFor(() => {
      expect(view.state.doc.toString()).toContain('![image](https://cdn.example.com/diagram.png)')
    })

    expect(api.ingestImage).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'diagram.png',
        documentFilePath: '/Users/pprp/docs/note.md',
      }),
    )
    expect(api.uploadImage).toHaveBeenCalledWith({
      filePath: '/Users/pprp/docs/assets/diagram.png',
      documentFilePath: '/Users/pprp/docs/note.md',
    })
  })

  it('keeps the managed local image path and shows an error toast when upload fails', async () => {
    const api = new MockMarkFlowAPI()
    api.setImageUploadSettingsState({
      autoUploadOnInsert: true,
      uploaderKind: 'custom-command',
      command: '/usr/local/bin/upload-image',
      arguments: '--token test',
      timeoutMs: 5_000,
      assetDirectoryName: 'assets',
      keepLocalCopyAfterUpload: true,
    })
    api.setNextImageUploadResult({
      success: false,
      error: 'PicGo authentication failed',
      timedOut: false,
    })
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Image upload preferences' })).toHaveTextContent(
        'Uploads: Custom',
      )
    })

    await act(async () => {
      api.emitFileOpened({
        filePath: '/Users/pprp/docs/note.md',
        content: 'Intro',
      })
    })

    const view = getEditorView(container)
    const placeholder = '\n\n![image](./diagram.png)'
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: placeholder },
        selection: { anchor: view.state.doc.length + placeholder.length },
      })
    })

    const imageFile = new File(['image'], 'diagram.png', { type: 'image/png' })

    await act(async () => {
      view.dom.dispatchEvent(
        new CustomEvent('mf-image-paste', {
          detail: {
            file: imageFile,
            markdownText: '![image](./diagram.png)',
            occurrenceIndex: 0,
          },
          bubbles: true,
          composed: true,
        }),
      )
    })

    await waitFor(() => {
      expect(view.state.doc.toString()).toContain('![image](./assets/diagram.png)')
      expect(screen.getByRole('alert')).toHaveTextContent('PicGo authentication failed')
    })
  })

  it('routes local markdown link clicks through the desktop bridge', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/Users/pprp/docs/note.md',
        content: 'Intro [Other](./other.md)',
      })
    })

    await waitFor(() => {
      expect(container.querySelector('a.mf-link')).toHaveAttribute('href', 'file:///Users/pprp/docs/other.md')
    })

    fireEvent.click(container.querySelector('a.mf-link') as Element, { ctrlKey: true })

    await waitFor(() => {
      expect(api.openPath).toHaveBeenCalledWith('/Users/pprp/docs/other.md')
    })
  })

  it('loads the sample markdown post-processor without breaking editing', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/Users/pprp/docs/note.md',
        content: 'Intro\n\n[OpenAI](https://openai.com)',
      })
    })

    const view = getEditorView(container)

    await waitFor(() => {
      const link = container.querySelector('a.mf-link')
      expect(link).toHaveAttribute('data-mf-link-kind', 'external')
      expect(link).toHaveClass('mf-link-external')
    })

    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: '\nSecond line' },
      })
    })

    expect(view.state.doc.toString()).toBe('Intro\n\n[OpenAI](https://openai.com)\nSecond line')
    expect(container.querySelector('.mf-titlebar-dirty-dot')).toBeInTheDocument()

    await waitFor(() => {
      expect(container.querySelectorAll('a.mf-link.mf-link-external')).toHaveLength(1)
    })
  })

  it('keeps theme controls out of the titlebar while still applying desktop theme updates', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    await waitFor(() => {
      expect(document.getElementById('mf-theme-overrides')).toHaveTextContent('--mf-accent: #9c5f2f')
    })

    expect(screen.queryByLabelText('Light theme')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Dark theme')).not.toBeInTheDocument()
    expect(screen.queryByText('Light mode')).not.toBeInTheDocument()
    expect(screen.queryByText('Dark mode')).not.toBeInTheDocument()
    expect(document.getElementById('mf-theme-overrides')).toHaveTextContent('--mf-accent: #9c5f2f')

    act(() => {
      api.emitThemeUpdated({
        activeAppearance: 'dark',
        appearancePreference: 'system',
        lightThemeId: 'paper',
        darkThemeId: 'midnight',
        activeTheme: { id: 'midnight', name: 'Midnight', cssText: ':root { --mf-bg: #111827; }' },
      })
    })

    await waitFor(() => {
      expect(document.getElementById('mf-theme-overrides')).toHaveTextContent('--mf-bg: #111827')
    })
  })

  it('opens spellcheck settings, switches dictionaries, and updates the custom dictionary through the profile API', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    const spellCheckButton = await screen.findByRole('button', { name: 'Spellcheck settings' })
    expect(spellCheckButton).toHaveTextContent('Spell: Default')

    fireEvent.click(spellCheckButton)

    const languageSelect = (await screen.findByLabelText('Spellcheck language')) as HTMLSelectElement
    expect(languageSelect.value).toBe('')

    fireEvent.change(languageSelect, { target: { value: 'de-DE' } })

    await waitFor(() => {
      expect(api.setSpellCheckLanguage).toHaveBeenCalledWith('de-DE')
      expect(languageSelect.value).toBe('de-DE')
      expect(spellCheckButton).toHaveTextContent('Spell: de-DE')
    })

    const customWordInput = (screen.getByLabelText('Add custom spellcheck word')) as HTMLInputElement
    fireEvent.change(customWordInput, { target: { value: 'MarkFlow' } })
    fireEvent.submit(customWordInput.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(api.addSpellCheckWord).toHaveBeenCalledWith('MarkFlow')
      expect(screen.getByRole('button', { name: 'Remove MarkFlow from custom dictionary' })).toBeInTheDocument()
      expect(customWordInput.value).toBe('')
    })

    fireEvent.change(languageSelect, { target: { value: '' } })

    await waitFor(() => {
      expect(api.setSpellCheckLanguage).toHaveBeenCalledWith(null)
      expect(spellCheckButton).toHaveTextContent('Spell: Default')
    })
  })

  it('toggles heading numbering in preferences without mutating markdown source or outline labels', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['# Intro', '', '## Setup', '', '### Deep Dive', '', '#### Details'].join('\n')
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/headings.md', content })
    })

    const headingButton = await screen.findByRole('button', { name: 'Heading numbering settings' })
    expect(headingButton).toHaveTextContent('Headings: Plain')

    fireEvent.click(headingButton)

    const checkbox = await screen.findByRole('checkbox', { name: 'Enable heading auto-numbering' })
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(headingButton).toHaveTextContent('Headings: 1.2')
      expect(container.firstElementChild).toHaveAttribute(HEADING_NUMBERING_ATTRIBUTE, 'true')
      expect(loadLocalHeadingNumberingPreference()).toBe(true)
    })

    const outline = await screen.findByRole('navigation', { name: 'Outline' })
    const outlineButtons = within(outline).getAllByRole('button')
    expect(outlineButtons.map((button) => button.textContent)).toEqual([
      'Intro',
      'Setup',
      'Deep Dive',
      'Details',
    ])
    expect(outlineButtons.map((button) => button.getAttribute(HEADING_NUMBERING_OUTLINE_LEVEL_ATTRIBUTE))).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])

    expect(document.getElementById(HEADING_NUMBERING_STYLE_ELEMENT_ID)).toHaveTextContent(
      'content: counter(mf-editor-h1) "." counter(mf-editor-h2) ". ";',
    )
    expect(container.querySelector('.cm-line.mf-h1')?.textContent).toBe('# Intro')
    expect(getEditorView(container).state.doc.toString()).toBe(content)
  })

  it('toggles source line numbers in preferences and only shows the gutter in source mode', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    const sourceLineNumbersButton = await screen.findByRole('button', { name: 'Source line-number settings' })
    expect(sourceLineNumbersButton).toHaveTextContent('Source lines: On')
    expect(container.querySelector('.cm-lineNumbers')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Source mode' }))

    await waitFor(() => {
      expect(container.querySelector('.cm-lineNumbers')).not.toBeNull()
      expect(getVisibleLineNumbers(container).slice(0, 3)).toEqual(['1', '2', '3'])
    })

    fireEvent.click(sourceLineNumbersButton)

    const checkbox = await screen.findByRole('checkbox', { name: 'Show line numbers in source mode' })
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(sourceLineNumbersButton).toHaveTextContent('Source lines: Off')
      expect(loadLocalSourceLineNumbersPreference()).toBe(false)
      expect(container.querySelector('.cm-lineNumbers')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Preview mode' }))

    await waitFor(() => {
      expect(container.querySelector('.cm-lineNumbers')).toBeNull()
    })
  })

  it('toggles markdown mode in preferences, updates heading parsing, and persists the choice', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['###Header', '', '10. aaa', '  1. ccc'].join('\n')
    const { container, unmount } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/markdown-mode.md', content })
    })

    const markdownModeButton = await screen.findByRole('button', { name: 'Markdown mode settings' })
    expect(markdownModeButton).toHaveTextContent('Markdown: Tolerant')

    await waitFor(() => {
      expect(container.querySelector('.cm-line.mf-h3')).not.toBeNull()
    })

    fireEvent.click(markdownModeButton)
    fireEvent.click(await screen.findByRole('radio', { name: 'Strict markdown parsing' }))

    await waitFor(() => {
      expect(markdownModeButton).toHaveTextContent('Markdown: Strict')
      expect(loadLocalMarkdownModePreference()).toBe('strict')
      expect(container.querySelector('.cm-line.mf-h3')).toBeNull()
    })

    unmount()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Markdown mode settings' })).toHaveTextContent(
      'Markdown: Strict',
    )
  })

  it('opens document statistics from the menu bridge and toggles fenced-code exclusion', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = [
      '# Intro',
      '',
      'Alpha beta gamma.',
      '',
      '```ts',
      'const hidden = true',
      '```',
      '',
      'Delta epsilon.',
    ].join('\n')
    const excludedStats = computeStats(content, '', { excludeFencedCode: true })
    const includedStats = computeStats(content, '', { excludeFencedCode: false })

    render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/statistics.md', content })
      api.emitMenuAction('toggle-document-statistics')
    })

    const summaryButton = await screen.findByRole('button', { name: /document statistics/i })
    const panel = await screen.findByRole('dialog', { name: 'Document statistics' })
    const exclusionToggle = within(panel).getByRole('checkbox', {
      name: 'Exclude fenced code blocks from counts',
    })
    const wordsRow = getStatisticsRow(panel, 'Words')
    const charactersRow = getStatisticsRow(panel, 'Characters')
    const readingTimeRow = getStatisticsRow(panel, 'Reading time')

    expect(summaryButton).toHaveTextContent(`${excludedStats.words.toLocaleString()} words`)
    expect(within(panel).getByRole('columnheader', { name: 'Document' })).toBeInTheDocument()
    expect(within(panel).queryByRole('columnheader', { name: 'Selection' })).not.toBeInTheDocument()
    expect(within(wordsRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      excludedStats.words.toLocaleString(),
    ])
    expect(within(charactersRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      excludedStats.chars.toLocaleString(),
    ])
    expect(within(readingTimeRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      `${excludedStats.readingMinutes} min`,
    ])

    fireEvent.click(exclusionToggle)

    await waitFor(() => {
      expect(loadLocalStatisticsPreferences().excludeFencedCode).toBe(false)
      expect(summaryButton).toHaveTextContent(`${includedStats.words.toLocaleString()} words`)
      expect(within(wordsRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
        includedStats.words.toLocaleString(),
      ])
      expect(within(charactersRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
        includedStats.chars.toLocaleString(),
      ])
    })
  })

  it('opens document statistics from the status bar and adds a selection column for multi-block selections', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = '# Intro\n\nAlpha beta\n\nGamma delta\n\nEpsilon zeta'
    const selectionText = 'Alpha beta\n\nGamma delta'
    const expectedStats = computeStats(content, selectionText, { excludeFencedCode: true })
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/selection-stats.md', content })
    })

    const view = getEditorView(container)
    const selectionStart = content.indexOf(selectionText)
    const selectionEnd = selectionStart + selectionText.length

    act(() => {
      view.dispatch({
        selection: { anchor: selectionStart, head: selectionEnd },
      })
    })

    const summaryButton = await screen.findByRole('button', { name: /document statistics/i })

    await waitFor(() => {
      expect(summaryButton).toHaveTextContent(
        `sel: ${expectedStats.selectionWords.toLocaleString()}w / ${expectedStats.selectionChars.toLocaleString()}c`,
      )
    })

    fireEvent.click(summaryButton)

    const panel = await screen.findByRole('dialog', { name: 'Document statistics' })
    const wordsRow = getStatisticsRow(panel, 'Words')
    const paragraphsRow = getStatisticsRow(panel, 'Paragraphs')

    expect(within(panel).getByRole('columnheader', { name: 'Selection' })).toBeInTheDocument()
    expect(within(wordsRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      expectedStats.words.toLocaleString(),
      expectedStats.selectionWords.toLocaleString(),
    ])
    expect(within(paragraphsRow).getAllByRole('cell').map((cell) => cell.textContent?.trim())).toEqual([
      expectedStats.paragraphs.toLocaleString(),
      expectedStats.selectionParagraphs.toLocaleString(),
    ])
  })

  it('shows an outline that mirrors heading hierarchy and navigates to the active heading', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['# Intro', '', '## Setup', '', '### Deep Dive', '', '# Appendix'].join('\n')
    const { container } = render(<App />)
    const setupHeadingPosition = content.indexOf('## Setup')

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/outline.md', content })
    })

    const outline = await screen.findByRole('navigation', { name: 'Outline' })
    expect(within(outline).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Intro',
      'Setup',
      'Deep Dive',
      'Appendix',
    ])

    expect(screen.getByRole('button', { name: 'Intro' })).toHaveAttribute('aria-current', 'true')
    const view = getEditorView(container)
    let topViewportPosition = 0
    const posAtCoordsSpy = vi.spyOn(view, 'posAtCoords').mockImplementation(() => topViewportPosition)

    fireEvent.click(screen.getByRole('button', { name: 'Appendix' }))

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('# Appendix'))
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Appendix' })).toHaveAttribute('aria-current', 'true')
    })

    act(() => {
      getEditorView(container).dispatch({
        selection: { anchor: content.indexOf('### Deep Dive') },
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deep Dive' })).toHaveAttribute(
        'aria-current',
        'true',
      )
    })

    act(() => {
      topViewportPosition = setupHeadingPosition
      Object.defineProperty(view.scrollDOM, 'scrollTop', {
        configurable: true,
        value: 300,
        writable: true,
      })
      fireEvent.scroll(view.scrollDOM)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Setup' })).toHaveAttribute('aria-current', 'true')
    })

    posAtCoordsSpy.mockRestore()
  })

  it('restores caret and scroll when navigating back and forward through outline history', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['# Intro', '', '## Setup', 'Alpha', '', '# Appendix', 'Omega'].join('\n')
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/history-outline.md', content })
    })

    const view = getEditorView(container)
    Object.defineProperty(view.scrollDOM, 'scrollTop', {
      value: 24,
      writable: true,
      configurable: true,
    })

    act(() => {
      view.dispatch({
        selection: { anchor: content.indexOf('# Intro') + 2 },
      })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Setup' }))

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('## Setup'))
    })

    act(() => {
      const activeView = getEditorView(container)
      activeView.scrollDOM.scrollTop = 180
      activeView.dispatch({
        selection: { anchor: content.indexOf('## Setup') + 4 },
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Appendix' }))

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('# Appendix'))
    })

    act(() => {
      const activeView = getEditorView(container)
      activeView.scrollDOM.scrollTop = 360
      activeView.dispatch({
        selection: { anchor: content.indexOf('# Appendix') + 6 },
      })
    })

    fireEvent.keyDown(document, { key: '[', ctrlKey: true })

    await waitFor(() => {
      const backView = getEditorView(container)
      expect(backView.state.selection.main.head).toBe(content.indexOf('## Setup') + 4)
      expect(backView.scrollDOM.scrollTop).toBe(180)
    })

    fireEvent.keyDown(document, { key: ']', ctrlKey: true })

    await waitFor(() => {
      const forwardView = getEditorView(container)
      expect(forwardView.state.selection.main.head).toBe(content.indexOf('# Appendix') + 6)
      expect(forwardView.scrollDOM.scrollTop).toBe(360)
    })
  })

  it('opens a go-to-line dialog with Cmd/Ctrl+L and jumps to the requested line', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['# Intro', 'Alpha', 'Beta', 'Gamma'].join('\n')
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/goto.md', content })
    })

    fireEvent.keyDown(document, { key: 'l', ctrlKey: true })

    const lineInput = await screen.findByRole('textbox', { name: 'Line number' })
    expect(screen.getByRole('dialog', { name: 'Go to line' })).toBeInTheDocument()
    expect(lineInput).toHaveValue('1')

    fireEvent.change(lineInput, { target: { value: '3' } })
    fireEvent.submit(lineInput.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('Beta'))
    })

    expect(screen.queryByRole('dialog', { name: 'Go to line' })).not.toBeInTheDocument()
  })

  it('clamps go-to-line requests to the final line when the input exceeds the document size', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = ['First', 'Second', 'Third'].join('\n')
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/goto-clamp.md', content })
    })

    fireEvent.keyDown(document, { key: 'l', ctrlKey: true })

    const lineInput = await screen.findByRole('textbox', { name: 'Line number' })
    fireEvent.change(lineInput, { target: { value: '999' } })
    fireEvent.submit(lineInput.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('Third'))
    })
  })

  it('routes go-to-line through the large-file window bridge and keeps the editor read-only', async () => {
    const api = new MockMarkFlowAPI()
    const initialPayload = buildWindowedPayload('/tmp/huge.md', 1, 400, 1)
    const jumpedPayload = buildWindowedPayload('/tmp/huge.md', 999_960, 1_000_359, 1_000_000)
    api.readLargeFileWindow = vi.fn(async () => jumpedPayload)
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened(initialPayload)
    })

    expect(getEditorView(container).state.facet(EditorView.editable)).toBe(false)
    expect(
      screen.getByText(/Large-file mode: showing lines 1-400 of 1,500,000\./),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'l', ctrlKey: true })

    const lineInput = await screen.findByRole('textbox', { name: 'Line number' })
    expect(screen.getByText('Line 1 of 1,500,000')).toBeInTheDocument()

    fireEvent.change(lineInput, { target: { value: '1000000' } })
    fireEvent.submit(lineInput.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(api.readLargeFileWindow).toHaveBeenCalledWith('/tmp/huge.md', 1000000)
    })

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(
        jumpedPayload.content.indexOf('Line 1000000'),
      )
    })

    expect(
      screen.getByText(/showing lines 999,960-1,000,359 of 1,500,000/),
    ).toBeInTheDocument()
    expect(screen.getByText('line 1,000,000 / 1,500,000')).toBeInTheDocument()
  })

  it('updates the large-file status bar line number from the editor cursor line directly', async () => {
    const api = new MockMarkFlowAPI()
    const initialPayload = buildWindowedPayload('/tmp/windowed.md', 100, 140, 100, 1_500_000)
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened(initialPayload)
    })

    expect(screen.getByText('line 100 / 1,500,000')).toBeInTheDocument()

    const view = getEditorView(container)
    const targetLine = view.state.doc.line(25)

    await act(async () => {
      view.dispatch({ selection: { anchor: targetLine.from + 1 } })
    })

    expect(screen.getByText('line 124 / 1,500,000')).toBeInTheDocument()
  })

  it('refreshes the large-file status bar when restored tab state changes before editor cursor events', async () => {
    vi.resetModules()
    vi.doMock('react', () => React)
    vi.doMock('../editor/MarkFlowEditor', () => ({
      MarkFlowEditor: React.forwardRef(
        ({ content }: { content: string }, ref: React.ForwardedRef<Record<string, unknown>>) => {
          React.useImperativeHandle(ref, () => ({
            captureSnapshot: () => null,
            clearDocumentSearch: () => {},
            executeCommand: () => false,
            focus: () => {},
            getContent: () => content,
            navigateDocumentSearch: () => false,
            replaceTextOccurrence: () => false,
            setDocumentSearchQuery: () => {},
          }))
          return <div data-testid="mock-markflow-editor">{content}</div>
        },
      ),
    }))

    try {
      const { App: AppWithMockedEditor } = await import('../App')
      const api = new MockMarkFlowAPI()
      const initialPayload = buildWindowedPayload('/tmp/restored-windowed.md', 1, 400, 1)
      const restoredPayload = buildWindowedPayload('/tmp/restored-windowed.md', 999_960, 1_000_359, 1_000_000)
      api.readLargeFileWindow = vi.fn(async () => restoredPayload)
      window.markflow = api

      render(<AppWithMockedEditor />)

      await act(async () => {
        api.emitFileOpened(initialPayload)
      })

      expect(screen.getByText('line 1 / 1,500,000')).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'l', ctrlKey: true })
      const lineInput = await screen.findByRole('textbox', { name: 'Line number' })
      fireEvent.change(lineInput, { target: { value: '1000000' } })

      await act(async () => {
        fireEvent.submit(lineInput.closest('form') as HTMLFormElement)
      })

      expect(screen.getByText('line 1,000,000 / 1,500,000')).toBeInTheDocument()
    } finally {
      vi.doUnmock('../editor/MarkFlowEditor')
      vi.doUnmock('react')
      vi.resetModules()
    }
  })

  it('toggles the minimap from the View menu bridge and clicks through to proportional navigation', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D)

    const content = Array.from({ length: 100 }, (_, index) => `Line ${index + 1}`).join('\n')
    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/minimap.md', content })
    })

    expect(screen.queryByRole('button', { name: 'Document minimap' })).not.toBeInTheDocument()

    await act(async () => {
      api.emitMenuAction('toggle-minimap')
    })

    const minimap = await screen.findByRole('button', { name: 'Document minimap' })
    Object.defineProperty(minimap, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 56,
        height: 200,
        top: 0,
        left: 0,
        right: 56,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    fireEvent.click(minimap, { clientY: 150 })

    await waitFor(() => {
      expect(getEditorView(container).state.selection.main.head).toBe(content.indexOf('Line 76'))
    })

    await act(async () => {
      api.emitMenuAction('toggle-minimap')
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Document minimap' })).not.toBeInTheDocument()
    })
  })

  it('hides chrome and restores panel visibility when toggling distraction-free mode', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = '# Heading\n\nBody paragraph\n\n## Details\n\nMore text'
    const { container } = render(<App />)
    const appRoot = container.firstElementChild as HTMLElement

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/distraction-free.md', content })
    })

    await act(async () => {
      api.emitMenuAction('toggle-sidebar')
      api.emitMenuAction('toggle-minimap')
    })

    await screen.findByRole('navigation', { name: 'Outline' })
    await screen.findByRole('button', { name: 'Document minimap' })

    expect(container.querySelector('.mf-titlebar')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
    expect(container.querySelector('.mf-statusbar')).toBeInTheDocument()
    expect(container.querySelector('.mf-sidebar')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Document minimap' })).toBeInTheDocument()

    await act(async () => {
      api.emitMenuAction('toggle-distraction-free')
    })

    await waitFor(() => {
      expect(appRoot).toHaveClass('mf-app-immersive')
      expect(appRoot).toHaveClass('mf-app-distraction-free')
      expect(container.querySelector('.mf-titlebar')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-statusbar')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-sidebar')).not.toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Outline' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Document minimap' })).not.toBeInTheDocument()
    })

    await act(async () => {
      api.emitMenuAction('toggle-distraction-free')
    })

    await waitFor(() => {
      expect(appRoot).not.toHaveClass('mf-app-immersive')
      expect(appRoot).not.toHaveClass('mf-app-distraction-free')
      expect(container.querySelector('.mf-titlebar')).toBeInTheDocument()
      expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-statusbar')).toBeInTheDocument()
      expect(container.querySelector('.mf-sidebar')).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Document minimap' })).toBeInTheDocument()
    })
  })

  it('restores the previous panel state after fullscreen exits', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const content = '# Heading\n\nBody paragraph\n\n## Details\n\nMore text'
    const { container } = render(<App />)
    const appRoot = container.firstElementChild as HTMLElement

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/fullscreen.md', content })
    })

    await act(async () => {
      api.emitMenuAction('toggle-minimap')
    })

    await screen.findByRole('button', { name: 'Document minimap' })
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse outline' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Outline' })).not.toBeInTheDocument()
    })

    expect(container.querySelector('.mf-sidebar')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Document minimap' })).toBeInTheDocument()

    await act(async () => {
      api.emitWindowStateChanged({ isAlwaysOnTop: false, isFullscreen: true })
    })

    await waitFor(() => {
      expect(appRoot).toHaveClass('mf-app-immersive')
      expect(appRoot).toHaveClass('mf-app-fullscreen')
      expect(container.querySelector('.mf-titlebar')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-statusbar')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-sidebar')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Document minimap' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Expand outline' })).not.toBeInTheDocument()
    })

    await act(async () => {
      api.emitWindowStateChanged({ isAlwaysOnTop: false, isFullscreen: false })
    })

    await waitFor(() => {
      expect(appRoot).not.toHaveClass('mf-app-immersive')
      expect(appRoot).not.toHaveClass('mf-app-fullscreen')
      expect(container.querySelector('.mf-titlebar')).toBeInTheDocument()
      expect(container.querySelector('.mf-tabstrip')).not.toBeInTheDocument()
      expect(container.querySelector('.mf-statusbar')).toBeInTheDocument()
      expect(container.querySelector('.mf-sidebar')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Document minimap' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Outline' })).not.toBeInTheDocument()
    })
  })

  it('persists the standalone outline collapse state when toggled', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api
    const localStorage = installTestLocalStorage()

    render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/outline-collapse.md',
        content: ['# Intro', '', '## Details'].join('\n'),
      })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Collapse outline' }))

    await waitFor(() => {
      expect(localStorage.getItem(OUTLINE_PANEL_STORAGE_KEY)).toBe(JSON.stringify({ collapsed: true }))
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Outline' })).not.toBeInTheDocument()
    })
  })

  it('initializes the standalone outline collapse state from storage on mount', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api
    installTestLocalStorage({
      [OUTLINE_PANEL_STORAGE_KEY]: JSON.stringify({ collapsed: true }),
    })

    render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/outline-collapse.md',
        content: ['# Intro', '', '## Details'].join('\n'),
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand outline' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Outline' })).not.toBeInTheDocument()
    })
  })

  it('persists reopening the standalone outline from a collapsed stored state', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api
    const localStorage = installTestLocalStorage({
      [OUTLINE_PANEL_STORAGE_KEY]: JSON.stringify({ collapsed: true }),
    })

    render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/outline-collapse.md',
        content: ['# Intro', '', '## Details'].join('\n'),
      })
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Expand outline' }))

    await waitFor(() => {
      expect(localStorage.getItem(OUTLINE_PANEL_STORAGE_KEY)).toBe(JSON.stringify({ collapsed: false }))
      expect(screen.getByRole('button', { name: 'Collapse outline' })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument()
    })
  })

  it('routes clear formatting through the menu bridge into the active editor selection', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/clear-formatting.md', content: 'Prefix [alpha](url) suffix' })
    })

    const view = getEditorView(container)
    const from = view.state.doc.toString().indexOf('lp')

    act(() => {
      view.dispatch({ selection: EditorSelection.range(from, from + 2) })
    })

    await act(async () => {
      api.emitMenuAction('clear-formatting')
    })

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe('Prefix [a](url)lp[ha](url) suffix')
    })
  })

  it('routes pandoc export menu actions (docx, epub, latex) through the desktop bridge', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/tmp/report.md', content: '# Report\n\nBody text.' })
    })

    await act(async () => {
      api.emitMenuAction('export-docx')
    })
    await waitFor(() => {
      expect(api.exportDocx).toHaveBeenCalledWith('# Report\n\nBody text.', '/tmp/report.docx')
    })

    await act(async () => {
      api.emitMenuAction('export-epub')
    })
    await waitFor(() => {
      expect(api.exportEpub).toHaveBeenCalledWith('# Report\n\nBody text.', '/tmp/report.epub')
    })

    await act(async () => {
      api.emitMenuAction('export-latex')
    })
    await waitFor(() => {
      expect(api.exportLatex).toHaveBeenCalledWith('# Report\n\nBody text.', '/tmp/report.tex')
    })
  })

  it('keeps the outline in sync when headings are renamed or reordered', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/outline.md',
        content: ['# Alpha', '', '## Beta'].join('\n'),
      })
    })

    const outline = await screen.findByRole('navigation', { name: 'Outline' })
    expect(within(outline).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Alpha',
      'Beta',
    ])

    act(() => {
      const view = getEditorView(container)
      const renameFrom = view.state.doc.toString().indexOf('Beta')
      view.dispatch({
        changes: { from: renameFrom, to: renameFrom + 4, insert: 'Beta renamed' },
      })
    })

    await waitFor(() => {
      expect(within(screen.getByRole('navigation', { name: 'Outline' })).getAllByRole('button').map(
        (button) => button.textContent,
      )).toEqual(['Alpha', 'Beta renamed'])
    })

    await act(async () => {
      api.emitFileOpened({
        filePath: '/tmp/outline.md',
        content: ['# Gamma', '', '## Beta renamed', '', '# Alpha'].join('\n'),
      })
    })

    await waitFor(() => {
      expect(within(screen.getByRole('navigation', { name: 'Outline' })).getAllByRole('button').map(
        (button) => button.textContent,
      )).toEqual(['Gamma', 'Beta renamed', 'Alpha'])
    })
  })
})

describe('App auto-save', () => {
  afterEach(() => {
    delete window.markflow
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does NOT schedule a recovery checkpoint for the untouched starter document', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    await waitFor(() => {
      expect(api.getRecoveryCheckpoint).toHaveBeenCalled()
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()
  })

  it('does NOT schedule a recovery checkpoint when a named file is open but clean', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/note.md', content: '# Hello' })
    })

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe('# Hello')
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()
  })

  it('schedules a recovery checkpoint when a document becomes dirty', async () => {
    vi.useFakeTimers()
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/note.md', content: '# Hello' })
    })

    // Make document dirty via a direct dispatch
    const view = getEditorView(container)
    await act(async () => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nnew text' } })
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECOVERY_CHECKPOINT_SYNC_DELAY_MS)
    })

    expect(api.scheduleRecoveryCheckpoint).toHaveBeenLastCalledWith({
      activeTabId: expect.any(String),
      documents: [
        {
          tabId: expect.any(String),
          filePath: '/docs/note.md',
          content: '# Hello\nnew text',
        },
      ],
    })
  })

  it('keeps inactive dirty tabs in the recovery checkpoint payload', async () => {
    vi.useFakeTimers()
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/alpha.md', content: '# Alpha' })
    })

    await act(async () => {
      getEditorView(container).dispatch({
        changes: { from: getEditorView(container).state.doc.length, insert: '\nalpha dirty' },
      })
    })

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/beta.md', content: '# Beta' })
    })

    await act(async () => {
      getEditorView(container).dispatch({
        changes: { from: getEditorView(container).state.doc.length, insert: '\nbeta dirty' },
      })
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECOVERY_CHECKPOINT_SYNC_DELAY_MS)
    })

    const recoveryPayload = vi.mocked(api.scheduleRecoveryCheckpoint).mock.lastCall?.[0]
    expect(recoveryPayload).toBeDefined()
    expect(recoveryPayload?.documents.map((document) => ({
      filePath: document.filePath,
      content: document.content,
    }))).toEqual([
      { filePath: '/docs/alpha.md', content: '# Alpha\nalpha dirty' },
      { filePath: '/docs/beta.md', content: '# Beta\nbeta dirty' },
    ])
    expect(recoveryPayload?.activeTabId).toBe(recoveryPayload?.documents[1]?.tabId ?? null)
  })

  it('coalesces rapid edits into one delayed recovery checkpoint payload', async () => {
    vi.useFakeTimers()
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/note.md', content: '# Hello' })
    })

    const view = getEditorView(container)
    await act(async () => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nfirst' } })
      await vi.advanceTimersByTimeAsync(RECOVERY_CHECKPOINT_SYNC_DELAY_MS - 1)
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nsecond' } })
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECOVERY_CHECKPOINT_SYNC_DELAY_MS)
    })

    expect(api.scheduleRecoveryCheckpoint).toHaveBeenCalledTimes(1)
    expect(api.scheduleRecoveryCheckpoint).toHaveBeenLastCalledWith({
      activeTabId: expect.any(String),
      documents: [
        {
          tabId: expect.any(String),
          filePath: '/docs/note.md',
          content: '# Hello\nfirst\nsecond',
        },
      ],
    })
  })

  it('builds recovery checkpoints from the live large-document buffer before deferred sync completes', async () => {
    vi.useFakeTimers()
    const api = new MockMarkFlowAPI()
    window.markflow = api
    const content = `# Large\n${'x'.repeat(LARGE_DOCUMENT_UI_THREAD_THRESHOLD_CHARS)}`

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/large.md', content })
    })

    const view = getEditorView(container)
    await act(async () => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nfirst' } })
      await vi.advanceTimersByTimeAsync(RECOVERY_CHECKPOINT_SYNC_DELAY_MS - 1)
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nsecond' } })
      await vi.advanceTimersByTimeAsync(LARGE_DOCUMENT_CONTENT_SYNC_DELAY_MS - 1)
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(api.scheduleRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        RECOVERY_CHECKPOINT_SYNC_DELAY_MS - LARGE_DOCUMENT_CONTENT_SYNC_DELAY_MS,
      )
    })

    const recoveryPayload = vi.mocked(api.scheduleRecoveryCheckpoint).mock.lastCall?.[0]
    expect(recoveryPayload?.documents).toHaveLength(1)
    expect(recoveryPayload?.documents[0]?.filePath).toBe('/docs/large.md')
    expect(recoveryPayload?.documents[0]?.content.endsWith('\nfirst\nsecond')).toBe(true)
  })

  it('prompts to recover the last checkpoint and restores it as a dirty document when accepted', async () => {
    const api = new MockMarkFlowAPI()
    const recoveryCheckpoint: MarkFlowRecoveryCheckpoint = {
      activeTabId: 'tab-recovered',
      documents: [
        {
          tabId: 'tab-recovered',
          filePath: '/docs/recovered.md',
          content: '# Recovered\n\ncheckpoint',
        },
      ],
      savedAt: '2026-04-15T12:00:00.000Z',
    }

    api.getRecoveryCheckpoint = vi.fn(async () => recoveryCheckpoint)
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled()
      expect(getEditorView(container).state.doc.toString()).toBe('# Recovered\n\ncheckpoint')
    })

    expect(expectActiveDocumentName('recovered.md')).toBeInTheDocument()
    expect(container.querySelector('.mf-tabstrip')).toBeInTheDocument()
    expect(container.querySelector('.mf-titlebar-dirty-dot')).toBeInTheDocument()
    expect(api.discardRecoveryCheckpoint).not.toHaveBeenCalled()

    await act(async () => {
      api.emitMenuAction('save-file')
    })

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('# Recovered\n\ncheckpoint', 'tab-recovered')
    })
  })

  it('discards the recovery checkpoint when the prompt is rejected', async () => {
    const api = new MockMarkFlowAPI()
    api.getRecoveryCheckpoint = vi.fn(async () => ({
      activeTabId: 'tab-recovered',
      documents: [
        {
          tabId: 'tab-recovered',
          filePath: '/docs/recovered.md',
          content: '# Recovered\n\ncheckpoint',
        },
      ],
      savedAt: '2026-04-15T12:00:00.000Z',
    }))

    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    window.markflow = api

    render(<App />)

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled()
      expect(api.discardRecoveryCheckpoint).toHaveBeenCalled()
    })
  })

  it('recovers multiple dirty tabs from one checkpoint payload', async () => {
    const api = new MockMarkFlowAPI()
    api.setWindowSession({
      documents: [
        { filePath: '/docs/alpha.md', content: '# Alpha' },
        { filePath: '/docs/beta.md', content: '# Beta' },
      ],
      activeFilePath: '/docs/alpha.md',
    })
    api.getRecoveryCheckpoint = vi.fn(async () => ({
      activeTabId: 'tab-beta',
      documents: [
        {
          tabId: 'tab-alpha',
          filePath: '/docs/alpha.md',
          content: '# Alpha\nalpha dirty',
        },
        {
          tabId: 'tab-beta',
          filePath: '/docs/beta.md',
          content: '# Beta\nbeta dirty',
        },
      ],
      savedAt: '2026-04-15T12:00:00.000Z',
    }))

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'beta.md' })).toHaveAttribute('aria-selected', 'true')
      expect(getEditorView(container).state.doc.toString()).toBe('# Beta\nbeta dirty')
      expect(container.querySelectorAll('.mf-tab-dirty-dot')).toHaveLength(2)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'alpha.md' }))
    })

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe('# Alpha\nalpha dirty')
    })
  })
})


describe('App Quick Open integration', () => {
  afterEach(() => {
    delete window.markflow
  })

  it('renders the bundle sidebar with recent and outline sections when the left rail is open', async () => {
    const api = new MockMarkFlowAPI()
    api.setStartupState({
      document: null,
      folderPath: '/docs',
      windowSession: null,
    })
    api.getVaultFiles = vi.fn(async () => ['/docs/alpha.md'])
    api.getQuickOpenList = vi.fn(async () => [
      {
        id: 'file:/recent/cherry.md',
        label: 'cherry.md',
        description: '/recent',
        filePath: '/recent/cherry.md',
        kind: 'file' as const,
        isRecent: true,
        isPinned: false,
      },
    ])
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/docs/alpha.md',
        content: '# Alpha\n\n## Section 1\n\nBody',
      })
    })

    const toggleSidebarButton = await screen.findByRole('button', { name: 'Toggle file sidebar' })
    if (!container.querySelector('.mf-sidebar')) {
      fireEvent.click(toggleSidebarButton)
    }

    const sidebar = await waitFor(() => {
      const element = container.querySelector('.mf-sidebar')
      expect(element).not.toBeNull()
      return element as HTMLElement
    })

    await waitFor(() => {
      expect(
        within(sidebar).getByText('Recent', { selector: '.mf-vault-section-header span' }),
      ).toBeInTheDocument()
      expect(
        within(sidebar).getByText('Outline', { selector: '.mf-vault-section-header span' }),
      ).toBeInTheDocument()
      expect(within(sidebar).getByRole('button', { name: 'cherry.md' })).toBeInTheDocument()
      expect(within(sidebar).getByRole('button', { name: 'Section 1' })).toBeInTheDocument()
    })
  })

  it('opens Quick Open on Mod-Shift-O, fuzzy-filters files, and dispatches file-open', async () => {
    const api = new MockMarkFlowAPI()
    api.getQuickOpenList = vi.fn(async () => [
      {
        id: '/docs/apple.md',
        label: 'apple.md',
        description: '/docs',
        filePath: '/docs/apple.md',
        kind: 'file' as const,
        isRecent: false,
        isPinned: false,
      },
      {
        id: '/docs/banana.md',
        label: 'banana.md',
        description: '/docs',
        filePath: '/docs/banana.md',
        kind: 'file' as const,
        isRecent: false,
        isPinned: false,
      },
      {
        id: 'file:/recent/cherry.md',
        label: 'cherry.md',
        description: '/recent',
        filePath: '/recent/cherry.md',
        kind: 'file' as const,
        isRecent: true,
        isPinned: false,
      },
    ])
    window.markflow = api

    render(<App />)

    // Trigger Quick Open (assuming Mac Mod-Shift-O)
    fireEvent.keyDown(document, { key: 'o', metaKey: true, shiftKey: true })
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search files or folders...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Search files or folders...')
    
    // Type query
    fireEvent.change(input, { target: { value: 'app' } })
    
    // Check filtered results
    expect(screen.getByText('apple.md')).toBeInTheDocument()
    expect(screen.queryByText('banana.md')).not.toBeInTheDocument()
    expect(screen.queryByText('cherry.md')).not.toBeInTheDocument()

    // Select the first item using Enter
    fireEvent.keyDown(screen.getByPlaceholderText('Search files or folders...'), { key: 'Enter' })

    await waitFor(() => {
      expect(api.openPath).toHaveBeenCalledWith('/docs/apple.md')
    })

    // Panel should close
    expect(screen.queryByPlaceholderText('Search files or folders...')).not.toBeInTheDocument()
  })
})

describe('App command palette integration', () => {
  afterEach(() => {
    delete window.markflow
  })

  it('opens the command palette on Mod/Ctrl+Shift+P and executes editor actions without losing selection state', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/palette.md', content: 'Plain paragraph' })
    })

    const view = getEditorView(container)
    act(() => {
      view.dispatch({ selection: EditorSelection.range(0, 5) })
    })
    Object.defineProperty(view.scrollDOM, 'scrollTop', {
      value: 120,
      writable: true,
      configurable: true,
    })

    fireEvent.keyDown(document, { key: 'p', metaKey: true, shiftKey: true })
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })

    const input = await screen.findByPlaceholderText('Search commands...')
    fireEvent.change(input, { target: { value: 'bold selection' } })
    fireEvent.click(screen.getByText('Bold Selection'))

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe('**Plain** paragraph')
    })

    expect(view.state.selection.main.from).toBe(2)
    expect(view.state.selection.main.to).toBe(7)
    expect(view.scrollDOM.scrollTop).toBe(120)
    expect(screen.queryByPlaceholderText('Search commands...')).not.toBeInTheDocument()
  })

  it('exposes clear formatting in the command palette and unwraps the live selection', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/palette-clear.md', content: 'Prefix [alpha](url) suffix' })
    })

    const view = getEditorView(container)
    const from = view.state.doc.toString().indexOf('lp')

    act(() => {
      view.dispatch({ selection: EditorSelection.range(from, from + 2) })
    })

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })

    const input = await screen.findByPlaceholderText('Search commands...')
    fireEvent.change(input, { target: { value: 'clear formatting' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe('Prefix [a](url)lp[ha](url) suffix')
    })

    expect(screen.queryByPlaceholderText('Search commands...')).not.toBeInTheDocument()
  })

  it('dispatches desktop-style actions such as quick open through the command palette', async () => {
    const api = new MockMarkFlowAPI()
    api.getQuickOpenList = vi.fn(async () => [
      {
        id: '/docs/alpha.md',
        label: 'alpha.md',
        description: '/docs',
        filePath: '/docs/alpha.md',
        kind: 'file' as const,
        isRecent: false,
        isPinned: false,
      },
    ])
    window.markflow = api

    render(<App />)

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true })

    const input = await screen.findByPlaceholderText('Search commands...')
    fireEvent.change(input, { target: { value: 'quick open' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(api.getQuickOpenList).toHaveBeenCalledTimes(1)
      expect(screen.getByPlaceholderText('Search files or folders...')).toBeInTheDocument()
    })

    expect(screen.queryByPlaceholderText('Search commands...')).not.toBeInTheDocument()
  })

  it('does not open global search when the shortcut event was already handled elsewhere', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)
    await screen.findByLabelText('Typewriter mode')

    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    event.preventDefault()

    act(() => {
      document.dispatchEvent(event)
    })

    expect(screen.queryByRole('dialog', { name: 'Global search' })).not.toBeInTheDocument()
  })

  it('pushes wikilink and global-search destinations onto navigation history across files', async () => {
    const api = new MockMarkFlowAPI()
    const alphaContent = ['# Alpha', '', '[[beta.md]]', '', 'search token'].join('\n')
    const betaContent = ['# Beta', '', 'Beta target', '', 'Wrap up'].join('\n')
    api.setDocument({ filePath: '/docs/beta.md', content: betaContent })
    api.openFolderPath = vi.fn(async () => ({ folderPath: '/docs' }))
    api.getVaultFiles = vi.fn(async () => ['/docs/alpha.md', '/docs/beta.md'])
    api.searchFiles = vi.fn(async () => [
      {
        filePath: '/docs/alpha.md',
        lineNumber: 5,
        lineText: 'search token',
        matchStart: 0,
        matchEnd: 6,
      },
    ])
    window.markflow = api

    const { container } = render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/alpha.md', content: alphaContent })
    })

    const view = getEditorView(container)
    Object.defineProperty(view.scrollDOM, 'scrollTop', {
      value: 40,
      writable: true,
      configurable: true,
    })

    act(() => {
      view.dispatch({
        selection: { anchor: alphaContent.indexOf('search token') + 2 },
      })
    })

    fireEvent.click(container.querySelector('a.mf-wikilink') as Element, { ctrlKey: true })

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe(betaContent)
      expect(screen.getByRole('tab', { name: 'beta.md' })).toHaveAttribute('aria-selected', 'true')
    })

    act(() => {
      const betaView = getEditorView(container)
      betaView.scrollDOM.scrollTop = 160
      betaView.dispatch({
        selection: { anchor: betaContent.indexOf('Beta target') + 5 },
      })
    })

    await act(async () => {
      api.emitMenuAction('open-recent-folder', '/docs')
    })

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true })

    const searchInput = await screen.findByRole('textbox', { name: 'Search query' })
    fireEvent.change(searchInput, { target: { value: 'search' } })

    await waitFor(() => {
      expect(api.searchFiles).toHaveBeenCalledWith('/docs', 'search')
    })

    const alphaSearchResult = await waitFor(() => {
      const lineLabel = screen.getByText('Line 5')
      return lineLabel.closest('[role="button"]') as HTMLElement
    })

    act(() => {
      const betaView = getEditorView(container)
      betaView.scrollDOM.scrollTop = 160
      betaView.dispatch({
        selection: { anchor: betaContent.indexOf('Beta target') + 5 },
      })
    })

    fireEvent.click(alphaSearchResult)

    await waitFor(() => {
      const alphaView = getEditorView(container)
      expect(alphaView.state.doc.toString()).toBe(alphaContent)
      expect(alphaView.state.selection.main.head).toBe(alphaContent.indexOf('search token'))
    })

    act(() => {
      const alphaView = getEditorView(container)
      alphaView.scrollDOM.scrollTop = 280
      alphaView.dispatch({
        selection: { anchor: alphaContent.indexOf('search token') + 4 },
      })
    })

    fireEvent.keyDown(document, { key: '[', ctrlKey: true })

    await waitFor(() => {
      const betaView = getEditorView(container)
      expect(betaView.state.doc.toString()).toBe(betaContent)
      expect(betaView.state.selection.main.head).toBe(betaContent.indexOf('Beta target') + 5)
      expect(betaView.scrollDOM.scrollTop).toBe(160)
    })

    fireEvent.keyDown(document, { key: '[', ctrlKey: true })

    await waitFor(() => {
      const alphaView = getEditorView(container)
      expect(alphaView.state.doc.toString()).toBe(alphaContent)
      expect(alphaView.state.selection.main.head).toBe(alphaContent.indexOf('search token') + 2)
      expect(alphaView.scrollDOM.scrollTop).toBe(40)
    })
  })

  it('fuzzy-search opens on Mod-F, reports a match count, and navigates between highlighted matches', async () => {
    const api = new MockMarkFlowAPI()
    const content = ['MarkFlow', 'meta flow', 'microfilm'].join('\n')
    api.setStartupState({
      document: {
        filePath: '/tmp/searchable.md',
        content,
      },
      folderPath: null,
      windowSession: null,
    })
    window.markflow = api

    const { container } = render(<App />)

    await waitFor(() => {
      expect(getEditorView(container).state.doc.toString()).toBe(content)
    })

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true })

    const input = await screen.findByRole('textbox', { name: 'Search document' })
    fireEvent.change(input, { target: { value: 'mf' } })

    await waitFor(() => {
      expect(screen.getByText('3 matches')).toBeInTheDocument()
      expect(container.querySelectorAll('.cm-searchMatch').length).toBeGreaterThan(0)
    })

    const view = getEditorView(container)

    // First Enter: navigate to first match
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(0)
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('MarkF')
    })

    // The search input must not lose focus after navigation so subsequent
    // Enter presses continue to cycle through matches without re-clicking.
    expect(document.activeElement).toBe(input)

    // Second Enter: navigate to second match
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(content.indexOf('meta flow'))
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('meta f')
    })

    // Shift+Enter: navigate back to first match
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    await waitFor(() => {
      expect(view.state.selection.main.from).toBe(0)
      expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('MarkF')
    })

    // Re-pressing Ctrl+F while the panel is open must re-focus the input
    fireEvent.keyDown(document, { key: 'f', ctrlKey: true })
    await waitFor(() => {
      expect(document.activeElement).toBe(input)
    })
  })

  it('does not render a false zero document-search count while async counting is pending', async () => {
    const api = new MockMarkFlowAPI()
    const content = ['MarkFlow', 'meta flow', 'microfilm'].join('\n')
    api.setStartupState({
      document: {
        filePath: '/tmp/searchable.md',
        content,
      },
      folderPath: null,
      windowSession: null,
    })
    window.markflow = api

    render(<App />)

    fireEvent.keyDown(document, { key: 'f', ctrlKey: true })

    const input = await screen.findByRole('textbox', { name: 'Search document' })
    fireEvent.change(input, { target: { value: 'mf' } })

    expect(screen.getByText('Searching...')).toBeInTheDocument()
    expect(screen.queryByText('0 matches')).not.toBeInTheDocument()
  })
})



describe('App export integration', () => {
  afterEach(() => {
    delete window.markflow
  })

  it('generates HTML from a hidden editor and calls exportHtml', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/exportme.md', content: '# Hello\n\nSome text' })
    })

    // Do NOT mock requestAnimationFrame, just wait for it using waitFor
    await act(async () => {
      api.emitMenuAction('export-html')
    })

    await waitFor(() => {
      expect(api.exportHtml).toHaveBeenCalled()
    }, { timeout: 2000 })

    const callArgs = (api.exportHtml as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toContain('Hello')
    expect(callArgs[0]).toContain('Some text')
    expect(callArgs[1]).toBe('/docs/exportme.html')
  })

  it('includes heading numbering counters in HTML export when the preference is enabled', async () => {
    const api = new MockMarkFlowAPI()
    persistLocalHeadingNumberingPreference(true)
    window.markflow = api

    render(<App />)

    await act(async () => {
      api.emitFileOpened({ filePath: '/docs/numbered-export.md', content: '# Hello\n\n## Setup\n\n### Details' })
    })

    await act(async () => {
      api.emitMenuAction('export-html')
    })

    await waitFor(() => {
      expect(api.exportHtml).toHaveBeenCalled()
    }, { timeout: 2000 })

    const callArgs = (api.exportHtml as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toContain(`${HEADING_NUMBERING_ATTRIBUTE}="true"`)
    expect(callArgs[0]).toContain('content: counter(mf-editor-h1) ". ";')
    expect(callArgs[0]).toContain('content: counter(mf-editor-h1) "." counter(mf-editor-h2) ". ";')
    expect(callArgs[0]).toContain('content: counter(mf-outline-h1) "." counter(mf-outline-h2) ". ";')
    expect(callArgs[1]).toBe('/docs/numbered-export.html')
  })

  it('serializes internal heading anchors and routes PDF export through the desktop bridge', async () => {
    const api = new MockMarkFlowAPI()
    window.markflow = api

    render(<App />)

    await act(async () => {
      api.emitFileOpened({
        filePath: '/docs/export.pdf.md',
        content: [
          '# Intro',
          '',
          'See [Setup](#setup).',
          '',
          '```typescript',
          'const value = 1',
          '```',
          '',
          '$$',
          'x^2',
          '$$',
          '',
          '| Name | Value |',
          '| --- | --- |',
          '| A | B |',
          '',
          '## Setup',
        ].join('\n'),
      })
    })

    await act(async () => {
      api.emitMenuAction('export-pdf')
    })

    await waitFor(() => {
      expect(api.exportPdf).toHaveBeenCalled()
    }, { timeout: 2000 })

    const callArgs = (api.exportPdf as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(callArgs[0]).toContain('id="intro"')
    expect(callArgs[0]).toContain('id="setup"')
    expect(callArgs[0]).toContain('href="#setup"')
    expect(callArgs[0]).not.toContain('href="#setup" target="_blank"')
    expect(callArgs[0]).toContain('mf-code-lang-badge')
    expect(callArgs[0]).toContain('mf-math-block')
    expect(callArgs[0]).toContain('mf-table-row')
    expect(callArgs[0]).toContain('@page {')
    expect(callArgs[1]).toBe('/docs/export.pdf.pdf')
  })
})
