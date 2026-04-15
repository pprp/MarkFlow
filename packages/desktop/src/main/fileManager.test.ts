import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileManager } from './fileManager'

const {
  handleMock,
  onMock,
  removeAllListenersMock,
  removeHandlerMock,
  showSaveDialogMock,
  appGetPathMock,
  execFileMock,
  showItemInFolderMock,
  nativeThemeOnMock,
  nativeThemeRemoveListenerMock,
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
  removeAllListenersMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  appGetPathMock: vi.fn(() => '/tmp'),
  execFileMock: vi.fn((file: string, args: string[], callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) callback(null, '', '')
  }),
  showItemInFolderMock: vi.fn(),
  nativeThemeOnMock: vi.fn(),
  nativeThemeRemoveListenerMock: vi.fn(),
}))

vi.mock('child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('electron', () => ({
  app: {
    getPath: appGetPathMock,
  },
  dialog: {
    showSaveDialog: showSaveDialogMock,
  },
  ipcMain: {
    handle: handleMock,
    on: onMock,
    removeAllListeners: removeAllListenersMock,
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
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    showItemInFolderMock.mockReset()
    nativeThemeOnMock.mockReset()
    nativeThemeRemoveListenerMock.mockReset()
    vi.restoreAllMocks()
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

    expect(result).toEqual({ success: true })
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

    expect(result).toEqual({ success: true })
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/notes-copy.md', '# Copy', 'utf-8')
    expect(window.webContents.send).toHaveBeenCalledWith('file-saved', { filePath: '/tmp/notes-copy.md' })
    expect(window.setRepresentedFilename).toHaveBeenCalledWith('/tmp/notes-copy.md')
    expect(((manager as unknown) as { currentFilePath: string | null }).currentFilePath).toBe('/tmp/notes-copy.md')
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


describe('FileManager Pandoc exports', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    execFileMock.mockClear()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    vi.restoreAllMocks()
    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue()
  })

  it('exports DOCX using pandoc', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.docx',
    })

    const result = await manager.exportPandoc('# Heading', 'Untitled', 'docx', 'Word Document', ['docx'])
    expect(result).toBe(true)

    // verify pandoc args
    const callArgs = execFileMock.mock.calls[0]
    expect(callArgs[0]).toBe('pandoc')
    expect(callArgs[1][1]).toBe('-o')
    expect(callArgs[1][2]).toBe('/tmp/export.docx')
    expect(callArgs[1]).not.toContain('--standalone')
  })

  it('exports LaTeX using pandoc with --standalone', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)

    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/export.tex',
    })

    const result = await manager.exportPandoc('# Heading', 'Untitled', 'latex', 'LaTeX', ['tex'])
    expect(result).toBe(true)

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
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    vi.restoreAllMocks()
  })

  it('streams large files in 64 KB chunks, emits progress, and opens the final document', async () => {
    const window = createWindowStub()
    const manager = new FileManager(window as never)
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-chunk-loader-'))
    const filePath = path.join(tempDir, 'large.md')
    const fileContent = `# Heading\nFirst screen\n${'Second chunk\n'.repeat(200000)}`

    fs.writeFileSync(filePath, fileContent, 'utf-8')

    const result = await manager.openPath(filePath)
    const progressCalls = window.webContents.send.mock.calls.filter(([channel]) => channel === 'file-loading-progress')

    expect(result).toEqual({
      filePath,
      content: fileContent,
    })
    expect(progressCalls.length).toBeGreaterThan(1)
    expect(progressCalls[0][1]).toEqual(
      expect.objectContaining({
        filePath,
        bytesRead: expect.any(Number),
        totalBytes: Buffer.byteLength(fileContent, 'utf-8'),
        previewContent: expect.stringContaining('# Heading\nFirst screen\n'),
        done: false,
      }),
    )
    expect(progressCalls.at(-1)?.[1]).toEqual(
      expect.objectContaining({
        filePath,
        bytesRead: Buffer.byteLength(fileContent, 'utf-8'),
        totalBytes: Buffer.byteLength(fileContent, 'utf-8'),
        previewContent: expect.stringContaining('# Heading\nFirst screen\n'),
        done: true,
      }),
    )
    expect(window.webContents.send).toHaveBeenCalledWith('file-opened', {
      filePath,
      content: fileContent,
    })
  })
})

describe('FileManager auto-save recovery checkpoints', () => {
  beforeEach(() => {
    handleMock.mockReset()
    onMock.mockReset()
    removeAllListenersMock.mockReset()
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  it('writes the last auto-save checkpoint to the temp directory after 30 seconds of idle time', async () => {
    const writeFileMock = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue()
    const manager = new FileManager(createWindowStub() as never)

    manager.scheduleRecoveryCheckpoint({ filePath: '/docs/note.md', content: '# draft 1' })
    await vi.advanceTimersByTimeAsync(20_000)
    manager.scheduleRecoveryCheckpoint({ filePath: '/docs/note.md', content: '# draft 2' })

    await vi.advanceTimersByTimeAsync(29_000)
    expect(writeFileMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/.markflow-recovery',
      expect.stringContaining('"content":"# draft 2"'),
      'utf-8',
    )
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
        filePath,
        content: '# Recovered draft',
        savedAt: '2026-04-15T12:00:00.000Z',
      }),
      'utf-8',
    )
    fs.writeFileSync(sessionStatePath, JSON.stringify({ cleanExit: false }), 'utf-8')
    fs.writeFileSync(filePath, '# Recovered draft', 'utf-8')

    expect(await manager.getRecoveryCheckpoint()).toEqual({
      filePath,
      content: '# Recovered draft',
      savedAt: '2026-04-15T12:00:00.000Z',
    })

    ;((manager as unknown) as { currentFilePath: string | null }).currentFilePath = filePath
    expect(await manager.saveFile('# Recovered draft')).toEqual({ success: true })
    expect(fs.existsSync(recoveryPath)).toBe(false)
  })
})
