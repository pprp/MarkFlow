import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileManager } from './fileManager'

const {
  handleMock,
  onMock,
  removeAllListenersMock,
  removeListenerMock,
  removeHandlerMock,
  showOpenDialogMock,
  showSaveDialogMock,
  showMessageBoxMock,
  appGetPathMock,
  addRecentDocumentMock,
  clearRecentDocumentsMock,
  execFileMock,
  showItemInFolderMock,
  nativeThemeOnMock,
  nativeThemeRemoveListenerMock,
  browserWindowConstructorMock,
  browserWindowLoadFileMock,
  browserWindowDestroyMock,
  browserWindowExecuteJavaScriptMock,
  browserWindowPrintToPdfMock,
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
  removeAllListenersMock: vi.fn(),
  removeListenerMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  showMessageBoxMock: vi.fn(),
  appGetPathMock: vi.fn(() => '/tmp'),
  addRecentDocumentMock: vi.fn(),
  clearRecentDocumentsMock: vi.fn(),
  execFileMock: vi.fn((file: string, args: string[], callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) callback(null, '', '')
  }),
  showItemInFolderMock: vi.fn(),
  nativeThemeOnMock: vi.fn(),
  nativeThemeRemoveListenerMock: vi.fn(),
  browserWindowConstructorMock: vi.fn((options: unknown) => {
    void options
  }),
  browserWindowLoadFileMock: vi.fn(async (filePath: string) => {
    void filePath
  }),
  browserWindowDestroyMock: vi.fn(),
  browserWindowExecuteJavaScriptMock: vi.fn(async (script: string) => {
    void script
    return true
  }),
  browserWindowPrintToPdfMock: vi.fn(async (options: unknown) => {
    void options
    return Buffer.from('pdf-data')
  }),
}))

vi.mock('child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {
    webContents = {
      executeJavaScript: browserWindowExecuteJavaScriptMock,
      printToPDF: browserWindowPrintToPdfMock,
    }

    constructor(options: unknown) {
      browserWindowConstructorMock(options)
    }

    loadFile(filePath: string) {
      return browserWindowLoadFileMock(filePath)
    }

    destroy() {
      browserWindowDestroyMock()
    }
  },
  app: {
    addRecentDocument: addRecentDocumentMock,
    clearRecentDocuments: clearRecentDocumentsMock,
    getPath: appGetPathMock,
  },
  dialog: {
    showOpenDialog: showOpenDialogMock,
    showSaveDialog: showSaveDialogMock,
    showMessageBox: showMessageBoxMock,
  },
  ipcMain: {
    handle: handleMock,
    on: onMock,
    removeAllListeners: removeAllListenersMock,
    removeListener: removeListenerMock,
    removeHandler: removeHandlerMock,
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: nativeThemeOnMock,
    removeListener: nativeThemeRemoveListenerMock,
  },
  shell: {
    showItemInFolder: showItemInFolderMock,
  },
}))

function createWindowStub() {
  return {
    webContents: {
      send: vi.fn(),
    },
    setTitle: vi.fn(),
    setRepresentedFilename: vi.fn(),
  }
}

describe('FileManager async saves', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    showItemInFolderMock.mockReset()
    nativeThemeOnMock.mockReset()
    nativeThemeRemoveListenerMock.mockReset()
    vi.restoreAllMocks()
  })

  it('clears direct export IPC handlers before registering replacements', () => {
    const manager = new FileManager(createWindowStub() as never)

    manager.registerIpcHandlers()

    const directExportChannels = [
      'export-html-to-path',
      'export-pdf-to-path',
      'export-docx-to-path',
      'export-epub-to-path',
      'export-latex-to-path',
    ]

    for (const channel of directExportChannels) {
      expect(removeHandlerMock).toHaveBeenCalledWith(channel)
      expect(handleMock).toHaveBeenCalledWith(channel, expect.any(Function))
    }
  })

  it('registers async save handlers that write the current file and emit file-saved', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const handlers = new Map<string, (...args: unknown[]) => unknown>()

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })

    manager.registerIpcHandlers()
    ;((manager as unknown) as { currentFilePath: string | null }).currentFilePath = '/tmp/notes.md'

    const result = await handlers.get('save-file')?.({}, '# Notes')

    expect(result).toEqual({ success: true, filePath: '/tmp/notes.md' })
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/notes.md', '# Notes', 'utf-8')
    expect(window.webContents.send).toHaveBeenCalledWith('file-saved', { filePath: '/tmp/notes.md' })
    expect(window.setTitle).toHaveBeenCalledWith('notes.md — MarkFlow')
  })

  it('registers open-path and returns null for missing linked files', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const handlers = new Map<string, (...args: unknown[]) => unknown>()

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })

    manager.registerIpcHandlers()

    const result = await handlers.get('open-path')?.({}, '/tmp/markflow-missing-link-target.md')

    expect(result).toBeNull()
    expect(window.webContents.send).not.toHaveBeenCalledWith('file-opened', expect.anything())
  })

  it('saves through save-as asynchronously and returns the selected file path', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/notes-copy.md',
    })

    const result = await manager.saveFileAs('# Copy')

    expect(result).toEqual({ success: true, filePath: '/tmp/notes-copy.md' })
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/notes-copy.md', '# Copy', 'utf-8')
    expect(window.webContents.send).toHaveBeenCalledWith('file-saved', { filePath: '/tmp/notes-copy.md' })
    expect(window.setRepresentedFilename).toHaveBeenCalledWith('/tmp/notes-copy.md')
    expect(((manager as unknown) as { currentFilePath: string | null }).currentFilePath).toBe('/tmp/notes-copy.md')
  })

  it('prompts for a target when saving an active untitled document after another file was open', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-untitled-save-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const originalPath = path.join(tempDir, 'original.md')
    const selectedPath = path.join(tempDir, 'new-draft.md')
    fs.writeFileSync(originalPath, '# Original', 'utf-8')

    const window = createWindowStub()
    const manager = new FileManager(window as never)
    await manager.saveWindowSession({
      filePaths: [originalPath],
      activeFilePath: originalPath,
    })
    await manager.saveWindowSession({
      filePaths: [originalPath],
      activeFilePath: null,
    })

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: selectedPath,
    })

    const result = await manager.saveFile('# Untitled draft', 'tab-untitled')

    expect(result).toEqual({ success: true, filePath: selectedPath })
    expect(showSaveDialogMock).toHaveBeenCalledWith(
      window,
      expect.objectContaining({
        defaultPath: 'untitled.md',
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      }),
    )
    expect(fs.readFileSync(originalPath, 'utf-8')).toBe('# Original')
    expect(fs.readFileSync(selectedPath, 'utf-8')).toBe('# Untitled draft')
    expect(window.webContents.send).toHaveBeenCalledWith('file-saved', { filePath: selectedPath })
    expect(window.setRepresentedFilename).toHaveBeenCalledWith(selectedPath)
    expect(((manager as unknown) as { currentFilePath: string | null }).currentFilePath).toBe(selectedPath)
  })

  it('returns a structured async error when writing fails', async () => {
    vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('disk full'))
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/notes-copy.md',
    })

    const result = await manager.saveFileAs('# Copy')

    expect(result).toEqual({ success: false, error: 'disk full' })
    expect(window.webContents.send).not.toHaveBeenCalledWith('file-saved', expect.anything())
    expect(((manager as unknown) as { currentFilePath: string | null }).currentFilePath).toBeNull()
  })

  it('reveals only saved files and uses the post-save-as path', async () => {
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    expect(manager.canRevealCurrentFile()).toBe(false)
    expect(manager.revealCurrentFileInFolder()).toBe(false)
    expect(showItemInFolderMock).not.toHaveBeenCalled()

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/notes-copy.md',
    })

    await manager.saveFileAs('# Copy')

    expect(manager.canRevealCurrentFile()).toBe(true)
    expect(manager.revealCurrentFileInFolder()).toBe(true)
    expect(showItemInFolderMock).toHaveBeenCalledWith('/tmp/notes-copy.md')

    await manager.newFile()

    expect(manager.canRevealCurrentFile()).toBe(false)
    expect(manager.revealCurrentFileInFolder()).toBe(false)
    expect(showItemInFolderMock).toHaveBeenCalledTimes(1)
  })
})

describe('FileManager recent history', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('persists recent files and folders across sessions in most-recent-first order', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-open-recent-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const firstFilePath = path.join(tempDir, 'alpha.md')
    const secondFilePath = path.join(tempDir, 'beta.md')
    const folderPath = path.join(tempDir, 'vault')
    fs.writeFileSync(firstFilePath, '# Alpha', 'utf-8')
    fs.writeFileSync(secondFilePath, '# Beta', 'utf-8')
    fs.mkdirSync(folderPath)

    const manager = new FileManager(createWindowStub() as never)
    await manager.openPath(firstFilePath)
    await manager.openExistingFolderPath(folderPath)
    await manager.openPath(secondFilePath)

    const nextSessionManager = new FileManager(createWindowStub() as never)
    const openRecentState = nextSessionManager.getOpenRecentMenuState()
    const quickOpenItems = await nextSessionManager.getQuickOpenList()

    expect(openRecentState.recentEntries.map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
      `file:${secondFilePath}`,
      `folder:${folderPath}`,
      `file:${firstFilePath}`,
    ])
    expect(quickOpenItems.map((item) => `${item.kind}:${item.filePath}`)).toEqual([
      `file:${secondFilePath}`,
      `folder:${folderPath}`,
      `file:${firstFilePath}`,
    ])
    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, '.markflow-open-recent.json'), 'utf-8')),
    ).toEqual({
      entries: [
        { kind: 'file', path: secondFilePath },
        { kind: 'folder', path: folderPath },
        { kind: 'file', path: firstFilePath },
      ],
      pinnedFolders: [],
    })
  })

  it('keeps pinned folders when clearing recent items and removes them only on full clear', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-open-recent-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const filePath = path.join(tempDir, 'alpha.md')
    const folderPath = path.join(tempDir, 'vault')
    fs.writeFileSync(filePath, '# Alpha', 'utf-8')
    fs.mkdirSync(folderPath)

    const manager = new FileManager(createWindowStub() as never)
    await manager.openPath(filePath)
    await manager.openExistingFolderPath(folderPath)
    await (
      (manager as unknown) as { pinRecentFolder: (nextFolderPath: string) => Promise<void> }
    ).pinRecentFolder(folderPath)

    let openRecentState = manager.getOpenRecentMenuState()
    expect(openRecentState.pinnedFolders.map((entry) => entry.path)).toEqual([folderPath])
    expect(openRecentState.recentEntries.map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
      `file:${filePath}`,
    ])

    await (
      (manager as unknown) as { clearRecentItems: () => Promise<void> }
    ).clearRecentItems()

    const nextSessionManager = new FileManager(createWindowStub() as never)

    openRecentState = nextSessionManager.getOpenRecentMenuState()
    expect(openRecentState.pinnedFolders.map((entry) => entry.path)).toEqual([folderPath])
    expect(openRecentState.recentEntries).toEqual([])
    expect(await nextSessionManager.getQuickOpenList()).toEqual([
      {
        id: `folder:${folderPath}`,
        label: 'vault',
        description: folderPath,
        filePath: folderPath,
        kind: 'folder',
        isRecent: true,
        isPinned: true,
      },
    ])
    expect(clearRecentDocumentsMock).toHaveBeenCalled()
    expect(addRecentDocumentMock).toHaveBeenLastCalledWith(folderPath)

    await (
      (nextSessionManager as unknown) as { clearRecentItemsAndPinnedFolders: () => Promise<void> }
    ).clearRecentItemsAndPinnedFolders()

    openRecentState = nextSessionManager.getOpenRecentMenuState()
    expect(openRecentState.pinnedFolders).toEqual([])
    expect(openRecentState.recentEntries).toEqual([])
  })

  it('shows an error dialog for missing recent files and returns null for missing recent folders', async () => {
    const manager = new FileManager(createWindowStub() as never)
    const missingFilePath = '/tmp/markflow-missing-recent-file.md'
    const missingFolderPath = '/tmp/markflow-missing-recent-folder'

    await (
      (manager as unknown) as { openRecentFileFromMenu: (filePath: string) => Promise<void> }
    ).openRecentFileFromMenu(missingFilePath)

    expect(showMessageBoxMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: 'Unable to open recent file',
        detail: expect.stringContaining(missingFilePath),
      }),
    )
    await expect(manager.openExistingFolderPath(missingFolderPath)).resolves.toBeNull()
  })
})

describe('FileManager window sessions', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('persists the open tab set and restores it with the previously active file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-window-session-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const firstPath = path.join(tempDir, 'first.md')
    const secondPath = path.join(tempDir, 'second.md')
    fs.writeFileSync(firstPath, '# First', 'utf-8')
    fs.writeFileSync(secondPath, '# Second', 'utf-8')

    const manager = new FileManager(createWindowStub() as never)

    await manager.saveWindowSession({
      filePaths: [firstPath, secondPath, firstPath],
      activeFilePath: secondPath,
    })

    expect(await manager.getWindowSession()).toEqual({
      documents: [
        { filePath: firstPath, content: '# First' },
        { filePath: secondPath, content: '# Second' },
      ],
      activeFilePath: secondPath,
    })
  })

  it('maps the dirty-close prompt buttons to save, discard, and cancel actions', async () => {
    const manager = new FileManager(createWindowStub() as never)

    showMessageBoxMock.mockResolvedValueOnce({ response: 0 })
    await expect(manager.confirmTabClose('notes.md')).resolves.toBe('save')

    showMessageBoxMock.mockResolvedValueOnce({ response: 1 })
    await expect(manager.confirmTabClose('notes.md')).resolves.toBe('discard')

    showMessageBoxMock.mockResolvedValueOnce({ response: 2 })
    await expect(manager.confirmTabClose('notes.md')).resolves.toBe('cancel')
  })
})

describe('FileManager launch options', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('persists the selected launch option and restores the last file plus folder on startup', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-options-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const folderPath = path.join(tempDir, 'vault')
    const filePath = path.join(folderPath, 'alpha.md')
    fs.mkdirSync(folderPath)
    fs.writeFileSync(filePath, '# Alpha', 'utf-8')

    const manager = new FileManager(createWindowStub() as never)
    await manager.openExistingFolderPath(folderPath)
    await manager.openPath(filePath)
    await manager.saveWindowSession({
      filePaths: [filePath],
      activeFilePath: filePath,
    })
    await manager.setLaunchBehavior('restore-last-file-and-folder')

    const nextSessionManager = new FileManager(createWindowStub() as never)
    const startupState = await nextSessionManager.getStartupState()

    expect(startupState).toEqual({
      document: null,
      folderPath,
      windowSession: {
        documents: [{ filePath, content: '# Alpha' }],
        activeFilePath: filePath,
      },
    })
    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, '.markflow-launch-options.json'), 'utf-8')),
    ).toEqual({
      behavior: 'restore-last-file-and-folder',
      defaultFolderPath: null,
      lastFilePath: filePath,
      lastFolderPath: folderPath,
    })
  })

  it('prefers an explicit startup file over persisted launch options', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-options-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const folderPath = path.join(tempDir, 'vault')
    const filePath = path.join(folderPath, 'alpha.md')
    const overridePath = path.join(tempDir, 'override.md')
    fs.mkdirSync(folderPath)
    fs.writeFileSync(filePath, '# Alpha', 'utf-8')
    fs.writeFileSync(overridePath, '# Override', 'utf-8')

    const manager = new FileManager(createWindowStub() as never)
    await manager.openExistingFolderPath(folderPath)
    await manager.openPath(filePath)
    await manager.saveWindowSession({
      filePaths: [filePath],
      activeFilePath: filePath,
    })
    await manager.setLaunchBehavior('restore-last-file-and-folder')

    const nextSessionManager = new FileManager(createWindowStub() as never)
    nextSessionManager.setStartupOverrideFilePath(overridePath)

    await expect(nextSessionManager.getStartupState()).resolves.toEqual({
      document: { filePath: overridePath, content: '# Override' },
      folderPath: null,
      windowSession: null,
    })
  })

  it('consumes the launch-argument startup override after one startup-state read', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-options-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const folderPath = path.join(tempDir, 'vault')
    const filePath = path.join(folderPath, 'alpha.md')
    fs.mkdirSync(folderPath)
    fs.writeFileSync(filePath, '# Alpha', 'utf-8')

    const manager = new FileManager(createWindowStub() as never)
    await manager.openExistingFolderPath(folderPath)
    await manager.openPath(filePath)
    await manager.saveWindowSession({
      filePaths: [filePath],
      activeFilePath: filePath,
    })
    await manager.setLaunchBehavior('restore-last-file-and-folder')

    const nextSessionManager = new FileManager(createWindowStub() as never)
    nextSessionManager.setStartupLaunchBehaviorOverride('open-new-file')

    await expect(nextSessionManager.getStartupState()).resolves.toEqual({
      document: null,
      folderPath: null,
      windowSession: null,
    })
    await expect(nextSessionManager.getStartupState()).resolves.toEqual({
      document: null,
      folderPath,
      windowSession: {
        documents: [{ filePath, content: '# Alpha' }],
        activeFilePath: filePath,
      },
    })
  })

  it('reopens the last file and folder when launch arguments request reopening files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-options-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const folderPath = path.join(tempDir, 'vault')
    const filePath = path.join(folderPath, 'alpha.md')
    fs.mkdirSync(folderPath)
    fs.writeFileSync(filePath, '# Alpha', 'utf-8')

    const manager = new FileManager(createWindowStub() as never)
    await manager.openExistingFolderPath(folderPath)
    await manager.openPath(filePath)
    await manager.saveWindowSession({
      filePaths: [filePath],
      activeFilePath: filePath,
    })

    const nextSessionManager = new FileManager(createWindowStub() as never)
    nextSessionManager.setStartupLaunchBehaviorOverride('restore-last-file-and-folder')

    await expect(nextSessionManager.getStartupState()).resolves.toEqual({
      document: null,
      folderPath,
      windowSession: {
        documents: [{ filePath, content: '# Alpha' }],
        activeFilePath: filePath,
      },
    })
  })

  it('opens the configured default folder on startup and falls back cleanly when it is missing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-options-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const existingFolderPath = path.join(tempDir, 'default-vault')
    const missingFolderPath = path.join(tempDir, 'missing-vault')
    fs.mkdirSync(existingFolderPath)

    const manager = new FileManager(createWindowStub() as never)
    await manager.setDefaultLaunchFolderPath(existingFolderPath)
    await manager.setLaunchBehavior('open-default-folder')

    let startupState = await new FileManager(createWindowStub() as never).getStartupState()
    expect(startupState).toEqual({
      document: null,
      folderPath: existingFolderPath,
      windowSession: null,
    })

    await manager.setDefaultLaunchFolderPath(missingFolderPath)
    startupState = await new FileManager(createWindowStub() as never).getStartupState()
    expect(startupState).toEqual({
      document: null,
      folderPath: null,
      windowSession: null,
    })
  })
})

describe('FileManager fold state sidecars', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('persists fold state ranges into a .folds sidecar and removes the sidecar when no folds remain', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    await manager.saveFoldState('/tmp/notes.md', [8, 20, 42, 64])
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/notes.md.folds', '[8,20,42,64]', 'utf-8')

    await manager.saveFoldState('/tmp/notes.md', [])
    expect(unlinkMock).toHaveBeenCalledWith('/tmp/notes.md.folds')
  })

  it('reads fold state ranges from the sidecar and ignores invalid payloads', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-fold-state-'))
    const filePath = path.join(tempDir, 'notes.md')
    const sidecarPath = `${filePath}.folds`
    const manager = new FileManager(createWindowStub() as never)

    fs.writeFileSync(sidecarPath, '[8,20,42,64]', 'utf-8')
    expect(await manager.getFoldState(filePath)).toEqual([8, 20, 42, 64])

    fs.writeFileSync(sidecarPath, '{"ranges":[1,2]}', 'utf-8')
    expect(await manager.getFoldState(filePath)).toEqual([])
  })
})


describe('FileManager Pandoc exports', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    execFileMock.mockClear()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    browserWindowConstructorMock.mockReset()
    browserWindowLoadFileMock.mockReset()
    browserWindowLoadFileMock.mockImplementation(async () => {})
    browserWindowDestroyMock.mockReset()
    browserWindowExecuteJavaScriptMock.mockReset()
    browserWindowExecuteJavaScriptMock.mockImplementation(async () => true)
    browserWindowPrintToPdfMock.mockReset()
    browserWindowPrintToPdfMock.mockImplementation(async () => Buffer.from('pdf-data'))
    vi.restoreAllMocks()
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue()
  })

  it('exports HTML and reports a visible error when the target path is not writable', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('EACCES: permission denied'))
    const manager = new FileManager(createWindowStub() as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.html',
    })

    const result = await manager.exportHtml('<h1>Export</h1>', 'Untitled.html')

    expect(result).toBeNull()
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/export.html', '<h1>Export</h1>', 'utf-8')
    expect(showMessageBoxMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'error',
        message: 'Unable to export HTML',
        detail: 'EACCES: permission denied',
      }),
    )
  })

  it('returns the accepted HTML save-dialog path after a successful export', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/changed-name.html',
    })

    const result = await manager.exportHtml('<h1>Export</h1>', 'Untitled.html')

    expect(result).toBe('/tmp/changed-name.html')
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/changed-name.html', '<h1>Export</h1>', 'utf-8')
  })

  it('does not return a target path when an HTML export is canceled', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: true,
      filePath: '/tmp/canceled.html',
    })

    const result = await manager.exportHtml('<h1>Export</h1>', 'Untitled.html')

    expect(result).toBeNull()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('exports HTML directly to an explicit path without opening the save dialog', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    const result = await (manager as unknown as {
      exportHtmlToPath: (html: string, targetPath: string) => Promise<boolean>
    }).exportHtmlToPath('<h1>Export</h1>', '/tmp/previous.html')

    expect(result).toBe(true)
    expect(showSaveDialogMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/previous.html', '<h1>Export</h1>', 'utf-8')
  })

  it('exports PDF from a temporary HTML file with outline-aware print options', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const unlinkMock = vi.spyOn(fs.promises, 'unlink').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.pdf',
    })

    const result = await manager.exportPdf('<h1 id="intro">Intro</h1>', 'Untitled.pdf')

    expect(result).toBe('/tmp/export.pdf')
    expect(browserWindowLoadFileMock).toHaveBeenCalledWith(expect.stringMatching(/markflow-export-.*\.html$/))
    expect(browserWindowExecuteJavaScriptMock).toHaveBeenCalledTimes(1)
    expect(browserWindowPrintToPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        printBackground: true,
        pageSize: 'A4',
        preferCSSPageSize: true,
        generateTaggedPDF: true,
        generateDocumentOutline: true,
      }),
    )
    expect(writeFileMock.mock.calls.at(-1)).toEqual(['/tmp/export.pdf', Buffer.from('pdf-data')])
    expect(unlinkMock).toHaveBeenCalledWith(expect.stringMatching(/markflow-export-.*\.html$/))
    expect(browserWindowDestroyMock).toHaveBeenCalledTimes(1)
  })

  it('exports PDF directly to an explicit path without opening the save dialog', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    const result = await (manager as unknown as {
      exportPdfToPath: (html: string, targetPath: string) => Promise<boolean>
    }).exportPdfToPath('<h1 id="intro">Intro</h1>', '/tmp/previous.pdf')

    expect(result).toBe(true)
    expect(showSaveDialogMock).not.toHaveBeenCalled()
    expect(writeFileMock.mock.calls.at(-1)).toEqual(['/tmp/previous.pdf', Buffer.from('pdf-data')])
  })

  it('shows a PDF export error dialog when the final path is not writable', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('EACCES: permission denied'))
    const manager = new FileManager(createWindowStub() as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.pdf',
    })

    const result = await manager.exportPdf('<h1 id="intro">Intro</h1>', 'Untitled.pdf')

    expect(result).toBeNull()
    expect(writeFileMock).toHaveBeenCalledTimes(2)
    expect(showMessageBoxMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'error',
        message: 'Unable to export PDF',
        detail: 'EACCES: permission denied',
      }),
    )
  })

  it('exports DOCX using pandoc', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.docx',
    })

    const result = await manager.exportPandoc('# Heading', 'Untitled', 'docx', 'Word Document', ['docx'])
    expect(result).toBe('/tmp/export.docx')

    // verify pandoc args
    const callArgs = execFileMock.mock.calls[0]
    expect(callArgs[0]).toBe('pandoc')
    expect(callArgs[1][1]).toBe('-o')
    expect(callArgs[1][2]).toBe('/tmp/export.docx')
    expect(callArgs[1]).not.toContain('--standalone')
  })

  it('exports Pandoc formats directly to an explicit path without opening the save dialog', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    const result = await (manager as unknown as {
      exportPandocToPath: (markdown: string, targetPath: string, format: string) => Promise<boolean>
    }).exportPandocToPath('# Heading', '/tmp/previous.docx', 'docx')

    expect(result).toBe(true)
    expect(showSaveDialogMock).not.toHaveBeenCalled()
    const callArgs = execFileMock.mock.calls[0]
    expect(callArgs[0]).toBe('pandoc')
    expect(callArgs[1][1]).toBe('-o')
    expect(callArgs[1][2]).toBe('/tmp/previous.docx')
  })

  it('exports LaTeX using pandoc with --standalone', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.tex',
    })

    const result = await manager.exportPandoc('# Heading', 'Untitled', 'latex', 'LaTeX', ['tex'])
    expect(result).toBe('/tmp/export.tex')

    // verify pandoc args
    const callArgs = execFileMock.mock.calls[0]
    expect(callArgs[0]).toBe('pandoc')
    expect(callArgs[1][1]).toBe('-o')
    expect(callArgs[1][2]).toBe('/tmp/export.tex')
    expect(callArgs[1]).toContain('--standalone')
  })
})

describe('FileManager chunk loader', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('streams large files in 64 KB chunks, emits progress, and opens the final document', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-chunk-loader-'))
    const filePath = path.join(tempDir, 'large.md')
    const fileContent = `# Heading\nFirst screen\n${'Second chunk\n'.repeat(90000)}`

    fs.writeFileSync(filePath, fileContent, 'utf-8')

    const result = await manager.openPath(filePath)
    const fileOpenedPayload = window.webContents.send.mock.calls.find(([channel]) => channel === 'file-opened')?.[1]
    const progressCalls = window.webContents.send.mock.calls
      .filter(([channel]) => channel === 'file-loading-progress')
      .map(([, payload]) => payload)
    window.webContents.send.mockClear()

    expect(result?.filePath).toBe(filePath)
    expect(result?.largeFile).toBeUndefined()
    expect(result?.content === fileContent).toBe(true)
    expect(progressCalls.length).toBeGreaterThan(1)
    expect(progressCalls[0]).toEqual(
      expect.objectContaining({
        filePath,
        bytesRead: expect.any(Number),
        totalBytes: Buffer.byteLength(fileContent, 'utf-8'),
        previewContent: expect.stringContaining('# Heading\nFirst screen\n'),
        done: false,
      }),
    )
    expect(progressCalls.at(-1)).toEqual(
      expect.objectContaining({
        filePath,
        bytesRead: Buffer.byteLength(fileContent, 'utf-8'),
        totalBytes: Buffer.byteLength(fileContent, 'utf-8'),
        previewContent: expect.stringContaining('# Heading\nFirst screen\n'),
        done: true,
      }),
    )
    expect(fileOpenedPayload).toEqual({
      filePath,
      content: fileContent,
    })
  })
})

describe('FileManager large file windowing', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
  })

  it('opens over-threshold files as bounded read-only windows and supports random-access jumps', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never, undefined, {
      windowedLineCheckpointInterval: 4,
      windowedLineContextBefore: 1,
      windowedLineWindowSize: 6,
      windowedOpenThresholdBytes: 32,
      windowedProgressIntervalBytes: 16,
      windowedReadChunkSize: 16,
    })
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-windowed-loader-'))
    const filePath = path.join(tempDir, 'huge.md')
    const lines = Array.from({ length: 20 }, (_, index) => `Line ${index + 1}`)
    const fileContent = lines.join('\n')
    const totalBytes = Buffer.byteLength(fileContent, 'utf-8')

    fs.writeFileSync(filePath, fileContent, 'utf-8')

    const opened = await manager.openPath(filePath)
    const jumped = await manager.readLargeFileWindow(filePath, 12)
    const progressCalls = window.webContents.send.mock.calls.filter(
      ([channel]) => channel === 'file-loading-progress',
    )

    expect(opened).toEqual({
      filePath,
      content: lines.slice(0, 6).join('\n'),
      largeFile: {
        totalBytes,
        totalLines: 20,
        windowStartLine: 1,
        windowEndLine: 6,
        anchorLine: 1,
        readOnly: true,
      },
    })
    expect(jumped).toEqual({
      filePath,
      content: lines.slice(10, 16).join('\n'),
      largeFile: {
        totalBytes,
        totalLines: 20,
        windowStartLine: 11,
        windowEndLine: 16,
        anchorLine: 12,
        readOnly: true,
      },
    })
    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls.at(-1)?.[1]).toEqual(
      expect.objectContaining({
        filePath,
        bytesRead: totalBytes,
        totalBytes,
        done: true,
      }),
    )
    expect(window.webContents.send).toHaveBeenCalledWith('file-opened', opened)
  })
})

describe('FileManager auto-save recovery checkpoints', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeListenerMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    showSaveDialogMock.mockReset()
    showMessageBoxMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    addRecentDocumentMock.mockReset()
    clearRecentDocumentsMock.mockReset()
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  it('writes the last auto-save checkpoint to the temp directory after 30 seconds of idle time', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    manager.scheduleRecoveryCheckpoint({
      activeTabId: 'tab-1',
      documents: [{ tabId: 'tab-1', filePath: '/docs/note.md', content: '# draft 1' }],
    })
    await vi.advanceTimersByTimeAsync(20_000)
    manager.scheduleRecoveryCheckpoint({
      activeTabId: 'tab-1',
      documents: [{ tabId: 'tab-1', filePath: '/docs/note.md', content: '# draft 2' }],
    })

    await vi.advanceTimersByTimeAsync(29_000)
    expect(writeFileMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/.markflow-recovery',
      expect.stringContaining('"documents":[{"tabId":"tab-1","filePath":"/docs/note.md","content":"# draft 2"}]'),
      'utf-8',
    )
  })

  it('uses harness storage path overrides for isolated desktop verification sessions', async () => {
    const harnessTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-harness-temp-'))
    const harnessUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-harness-user-data-'))
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()

    process.env.MARKFLOW_HARNESS_TEMP_DIR = harnessTempDir
    process.env.MARKFLOW_HARNESS_USER_DATA_DIR = harnessUserDataDir

    try {
      const manager = new FileManager(createWindowStub() as never)
      await ((manager as unknown) as {
        writeSessionState(state: { cleanExit: boolean }): Promise<void>
      }).writeSessionState({ cleanExit: false })

      manager.scheduleRecoveryCheckpoint({
        activeTabId: 'tab-1',
        documents: [{ tabId: 'tab-1', filePath: null, content: '# isolated draft' }],
      })
      await vi.advanceTimersByTimeAsync(30_000)

      expect(writeFileMock).toHaveBeenCalledWith(
        path.join(harnessUserDataDir, '.markflow-recovery-session.json'),
        JSON.stringify({ cleanExit: false }),
        'utf-8',
      )
      expect(writeFileMock).toHaveBeenCalledWith(
        path.join(harnessTempDir, '.markflow-recovery'),
        expect.stringContaining('# isolated draft'),
        'utf-8',
      )
    } finally {
      delete process.env.MARKFLOW_HARNESS_TEMP_DIR
      delete process.env.MARKFLOW_HARNESS_USER_DATA_DIR
    }
  })

  it('surfaces the last auto-save checkpoint after an unclean shutdown and discards it after a manual save', async () => {
    vi.useRealTimers()

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-recovery-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const recoveryPath = path.join(tempDir, '.markflow-recovery')
    const sessionStatePath = path.join(tempDir, '.markflow-recovery-session.json')
    const filePath = path.join(tempDir, 'note.md')

    fs.writeFileSync(
      recoveryPath,
      JSON.stringify({
        activeTabId: 'tab-recovered',
        documents: [{ tabId: 'tab-recovered', filePath, content: '# Recovered draft' }],
        savedAt: '2026-04-15T12:00:00.000Z',
      }),
      'utf-8',
    )
    fs.writeFileSync(sessionStatePath, JSON.stringify({ cleanExit: false }), 'utf-8')
    fs.writeFileSync(filePath, '# Recovered draft', 'utf-8')

    expect(await manager.getRecoveryCheckpoint()).toEqual({
      activeTabId: 'tab-recovered',
      documents: [{ tabId: 'tab-recovered', filePath, content: '# Recovered draft' }],
      savedAt: '2026-04-15T12:00:00.000Z',
    })

    ;((manager as unknown) as { currentFilePath: string | null }).currentFilePath = filePath
    expect(await manager.saveFile('# Recovered draft', 'tab-recovered')).toEqual({ success: true, filePath })
    expect(fs.existsSync(recoveryPath)).toBe(false)
  })

  it('keeps other dirty-tab recovery data when one recovered tab is saved', async () => {
    vi.useRealTimers()

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-recovery-'))
    appGetPathMock.mockImplementation(() => tempDir)

    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const recoveryPath = path.join(tempDir, '.markflow-recovery')
    const sessionStatePath = path.join(tempDir, '.markflow-recovery-session.json')
    const firstFilePath = path.join(tempDir, 'one.md')
    const secondFilePath = path.join(tempDir, 'two.md')

    fs.writeFileSync(
      recoveryPath,
      JSON.stringify({
        activeTabId: 'tab-one',
        documents: [
          { tabId: 'tab-one', filePath: firstFilePath, content: '# One dirty' },
          { tabId: 'tab-two', filePath: secondFilePath, content: '# Two dirty' },
        ],
        savedAt: '2026-04-15T12:00:00.000Z',
      }),
      'utf-8',
    )
    fs.writeFileSync(sessionStatePath, JSON.stringify({ cleanExit: false }), 'utf-8')
    fs.writeFileSync(firstFilePath, '# One dirty', 'utf-8')
    fs.writeFileSync(secondFilePath, '# Two', 'utf-8')

    ;((manager as unknown) as { currentFilePath: string | null }).currentFilePath = firstFilePath
    expect(await manager.saveFile('# One dirty', 'tab-one')).toEqual({ success: true, filePath: firstFilePath })
    expect(await manager.getRecoveryCheckpoint()).toEqual({
      activeTabId: null,
      documents: [{ tabId: 'tab-two', filePath: secondFilePath, content: '# Two dirty' }],
      savedAt: '2026-04-15T12:00:00.000Z',
    })
  })
})
