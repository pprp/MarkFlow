import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileManager } from './fileManager'

const { handleMock, removeHandlerMock, showSaveDialogMock, appGetPathMock, execFileMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  appGetPathMock: vi.fn(() => '/tmp'),
  execFileMock: vi.fn((file: string, args: string[], callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) callback(null, '', '')
  }),
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
    removeHandler: removeHandlerMock,
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
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
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
})


describe('FileManager Pandoc exports', () => {
  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
    execFileMock.mockClear()
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
    removeHandlerMock.mockReset()
    showSaveDialogMock.mockReset()
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
