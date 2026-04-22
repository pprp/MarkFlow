import * as fs from 'fs'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileManager } from './fileManager'

const {
  appGetPathMock,
  handleMock,
  removeHandlerMock,
  showSaveDialogMock,
  showOpenDialogMock,
  nativeThemeOnMock,
  nativeThemeRemoveListenerMock,
} = vi.hoisted(() => ({
  appGetPathMock: vi.fn(() => '/tmp'),
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
  nativeThemeOnMock: vi.fn(),
  nativeThemeRemoveListenerMock: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath: appGetPathMock,
  },
  dialog: {
    showSaveDialog: showSaveDialogMock,
    showOpenDialog: showOpenDialogMock,
  },
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
  nativeTheme: {
    shouldUseDarkColors: false,
    on: nativeThemeOnMock,
    removeListener: nativeThemeRemoveListenerMock,
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>()
  return {
    ...actual,
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
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

describe('FileManager global search integration', () => {
  beforeEach(() => {
    appGetPathMock.mockReset()
    appGetPathMock.mockImplementation(() => '/tmp')
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    nativeThemeOnMock.mockReset()
    nativeThemeRemoveListenerMock.mockReset()
    vi.mocked(fs.readdirSync).mockReset()
    vi.mocked(fs.readFileSync).mockReset()
    vi.restoreAllMocks()
  })

  it('returns empty array when query is empty', () => {
    const manager = new FileManager(createWindowStub() as never)
    const result = manager.searchFiles('/tmp/vault', '   ')
    expect(result).toEqual([])
  })

  it('searches across vault files returning exact matches case-insensitively', () => {
    const manager = new FileManager(createWindowStub() as never)

    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      const dirStr = String(dir)
      if (dirStr === '/tmp/vault') {
        return [
          { name: 'doc1.md', isDirectory: () => false, isFile: () => true },
          { name: 'doc2.txt', isDirectory: () => false, isFile: () => true },
        ] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    vi.mocked(fs.readFileSync).mockImplementation((filepath: fs.PathOrFileDescriptor) => {
      if (filepath === path.join('/tmp/vault', 'doc1.md')) {
        return 'Line 1: No match\nLine 2: Has #tag inside\nLine 3: Another #TAG here and #tag again\n'
      }
      if (filepath === path.join('/tmp/vault', 'doc2.txt')) {
        return 'No tags here'
      }
      return ''
    })

    const results = manager.searchFiles('/tmp/vault', '#tag')

    expect(results).toHaveLength(3)
    
    expect(results[0]).toEqual({
      filePath: path.join('/tmp/vault', 'doc1.md'),
      lineNumber: 2,
      lineText: 'Line 2: Has #tag inside',
      matchStart: 12,
      matchEnd: 16,
    })

    expect(results[1]).toEqual({
      filePath: path.join('/tmp/vault', 'doc1.md'),
      lineNumber: 3,
      lineText: 'Line 3: Another #TAG here and #tag again',
      matchStart: 16,
      matchEnd: 20,
    })

    expect(results[2]).toEqual({
      filePath: path.join('/tmp/vault', 'doc1.md'),
      lineNumber: 3,
      lineText: 'Line 3: Another #TAG here and #tag again',
      matchStart: 30,
      matchEnd: 34,
    })
  })

  it('honors case-sensitive literal search', () => {
    const manager = new FileManager(createWindowStub() as never)

    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (String(dir) === '/tmp/vault') {
        return [{ name: 'case.md', isDirectory: () => false, isFile: () => true }] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    vi.mocked(fs.readFileSync).mockReturnValue('Alpha alpha ALPHA')

    const results = manager.searchFiles('/tmp/vault', 'alpha', { caseSensitive: true })

    expect(results).toEqual([
      {
        filePath: path.join('/tmp/vault', 'case.md'),
        lineNumber: 1,
        lineText: 'Alpha alpha ALPHA',
        matchStart: 6,
        matchEnd: 11,
      },
    ])
  })

  it('matches only whole literal words when requested', () => {
    const manager = new FileManager(createWindowStub() as never)

    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (String(dir) === '/tmp/vault') {
        return [{ name: 'words.md', isDirectory: () => false, isFile: () => true }] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    vi.mocked(fs.readFileSync).mockReturnValue('cat scatter catapult cat cat-cat cat_1')

    const results = manager.searchFiles('/tmp/vault', 'cat', { wholeWord: true })

    expect(results.map((result) => [result.matchStart, result.matchEnd])).toEqual([
      [0, 3],
      [21, 24],
      [25, 28],
      [29, 32],
    ])
  })

  it('supports regular expression search with multiple matches per line', () => {
    const manager = new FileManager(createWindowStub() as never)

    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (String(dir) === '/tmp/vault') {
        return [{ name: 'tags.md', isDirectory: () => false, isFile: () => true }] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    vi.mocked(fs.readFileSync).mockReturnValue('Tagged #Alpha and #beta, but not plain text')

    const results = manager.searchFiles('/tmp/vault', '#[a-z]+', { regexp: true })

    expect(results.map((result) => result.lineText.slice(result.matchStart, result.matchEnd))).toEqual([
      '#Alpha',
      '#beta',
    ])
  })

  it('returns empty results for invalid regular expressions without throwing', () => {
    const manager = new FileManager(createWindowStub() as never)

    vi.mocked(fs.readdirSync).mockImplementation(((dir: fs.PathLike) => {
      if (String(dir) === '/tmp/vault') {
        return [{ name: 'broken.md', isDirectory: () => false, isFile: () => true }] as unknown as fs.Dirent[]
      }
      return [] as unknown as fs.Dirent[]
    }) as never)

    vi.mocked(fs.readFileSync).mockReturnValue('anything')

    expect(() => manager.searchFiles('/tmp/vault', '[', { regexp: true })).not.toThrow()
    expect(manager.searchFiles('/tmp/vault', '[', { regexp: true })).toEqual([])
  })
})
