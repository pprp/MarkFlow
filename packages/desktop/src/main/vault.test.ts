import * as fs from 'fs'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileManager } from './fileManager'

const { handleMock, removeHandlerMock, showSaveDialogMock, showOpenDialogMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
}))

vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: showSaveDialogMock,
    showOpenDialog: showOpenDialogMock,
  },
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()
  return {
    ...actual,
    readdirSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn()
  }
})

function createWindowStub() {
  return {
    webContents: {
      send: vi.fn(),
    },
    setTitle: vi.fn(),
    setRepresentedFilename: vi.fn(),
  }
}

describe('FileManager vault integration', () => {
  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    showOpenDialogMock.mockReset()
    vi.mocked(fs.readdirSync).mockReset()
    vi.mocked(fs.renameSync).mockReset()
    vi.mocked(fs.unlinkSync).mockReset()
    vi.restoreAllMocks()
  })

  it('can select a folder using openFolder', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/vault'],
    })

    const manager = new FileManager(createWindowStub() as never)
    const result = await manager.openFolder()
    
    expect(result).toEqual({ folderPath: '/tmp/vault' })
  })

  it('returns null when folder selection is canceled', async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: true,
      filePaths: [],
    })

    const manager = new FileManager(createWindowStub() as never)
    const result = await manager.openFolder()
    
    expect(result).toBeNull()
  })

  it('retrieves vault markdown files via recursive walk', async () => {
    const manager = new FileManager(createWindowStub() as never)
    
    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      const dirStr = String(dir)
      if (dirStr === '/tmp/vault') {
        return [
          { name: 'doc1.md', isDirectory: () => false, isFile: () => true },
          { name: 'text.txt', isDirectory: () => false, isFile: () => true },
          { name: 'script.js', isDirectory: () => false, isFile: () => true },
          { name: 'sub', isDirectory: () => true, isFile: () => false },
          { name: '.hidden', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]
      } else if (dirStr === '/tmp/vault/sub' || dirStr === path.join('/tmp/vault', 'sub')) {
        return [
          { name: 'doc2.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    const files = manager.getVaultFiles('/tmp/vault')
    
    // Sort logic from FileManager
    expect(files).toEqual([
      path.join('/tmp/vault', 'doc1.md'),
      path.join('/tmp/vault', 'sub', 'doc2.md'),
      path.join('/tmp/vault', 'text.txt')
    ])
  })

  it('renames a file', async () => {
    const manager = new FileManager(createWindowStub() as never)
    
    manager.renameFile('/tmp/vault/old.md', '/tmp/vault/new.md')
    expect(fs.renameSync).toHaveBeenCalledWith('/tmp/vault/old.md', '/tmp/vault/new.md')
  })

  it('deletes a file', async () => {
    const manager = new FileManager(createWindowStub() as never)
    
    manager.deleteFile('/tmp/vault/del.md')
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/vault/del.md')
  })
})
