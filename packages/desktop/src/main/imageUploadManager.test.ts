import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkFlowImageUploadSettings } from '@markflow/shared'
import { ImageUploadManager } from './imageUploadManager'

const { handleMock, removeHandlerMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
}))

function createSettings(overrides: Partial<MarkFlowImageUploadSettings> = {}): MarkFlowImageUploadSettings {
  return {
    autoUploadOnInsert: true,
    uploaderKind: 'picgo-core',
    command: 'picgo',
    arguments: 'upload --silent',
    timeoutMs: 5_000,
    assetDirectoryName: 'assets',
    keepLocalCopyAfterUpload: true,
    ...overrides,
  }
}

describe('ImageUploadManager', () => {
  let tempDir: string
  let execFileMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-image-upload-'))
    execFileMock = vi.fn()
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('uploads a managed image copy and preserves it when keepLocalCopyAfterUpload is enabled', async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'Upload Success\nhttps://cdn.example.com/diagram.png\n', '')
      },
    )

    const manager = new ImageUploadManager(tempDir, {
      execFileFn: execFileMock,
    })
    await manager.initialize()
    await manager.setImageUploadSettings(createSettings())

    const documentDir = path.join(tempDir, 'notes')
    await fs.promises.mkdir(documentDir, { recursive: true })
    const ingestResult = await manager.ingestImage({
      fileName: 'diagram.png',
      mimeType: 'image/png',
      documentFilePath: path.join(documentDir, 'note.md'),
      data: new Uint8Array([1, 2, 3, 4]),
    })

    expect(ingestResult.markdownSource).toBe('./assets/diagram.png')
    expect(fs.existsSync(ingestResult.localFilePath)).toBe(true)

    const uploadResult = await manager.uploadImage({
      filePath: ingestResult.localFilePath,
      documentFilePath: path.join(documentDir, 'note.md'),
    })

    expect(uploadResult).toEqual({
      success: true,
      remoteUrl: 'https://cdn.example.com/diagram.png',
    })
    expect(execFileMock).toHaveBeenCalledWith(
      'picgo',
      ['upload', '--silent', ingestResult.localFilePath],
      expect.objectContaining({
        cwd: documentDir,
        timeout: 5_000,
      }),
      expect.any(Function),
    )
    expect(fs.existsSync(ingestResult.localFilePath)).toBe(true)
  })

  it('returns the uploader stderr when the command fails', async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error('Command failed'), '', 'authentication failed')
      },
    )

    const manager = new ImageUploadManager(tempDir, {
      execFileFn: execFileMock,
    })
    await manager.initialize()
    await manager.setImageUploadSettings(
      createSettings({
        uploaderKind: 'custom-command',
        command: '/usr/local/bin/upload-image',
        arguments: '--token test-token',
      }),
    )

    const uploadResult = await manager.uploadImage({
      filePath: path.join(tempDir, 'assets', 'broken.png'),
      documentFilePath: path.join(tempDir, 'note.md'),
    })

    expect(uploadResult).toEqual({
      success: false,
      timedOut: false,
      error: 'authentication failed',
    })
    expect(execFileMock).toHaveBeenCalledWith(
      '/usr/local/bin/upload-image',
      ['--token', 'test-token', path.join(tempDir, 'assets', 'broken.png')],
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('allows manual uploads when auto upload on insert is disabled', async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'https://cdn.example.com/manual.png\n', '')
      },
    )

    const manager = new ImageUploadManager(tempDir, {
      execFileFn: execFileMock,
    })
    await manager.initialize()
    await manager.setImageUploadSettings(
      createSettings({
        autoUploadOnInsert: false,
      }),
    )

    const documentPath = path.join(tempDir, 'note.md')
    const imagePath = path.join(tempDir, 'assets', 'manual.png')
    const uploadResult = await manager.uploadImage({
      filePath: imagePath,
      documentFilePath: documentPath,
      manual: true,
    })

    expect(uploadResult).toEqual({
      success: true,
      remoteUrl: 'https://cdn.example.com/manual.png',
    })
    expect(execFileMock).toHaveBeenCalledWith(
      'picgo',
      ['upload', '--silent', imagePath],
      expect.objectContaining({
        cwd: tempDir,
        timeout: 5_000,
      }),
      expect.any(Function),
    )
  })

  it('reports timeout failures and removes managed copies when keepLocalCopyAfterUpload is disabled', async () => {
    execFileMock.mockImplementationOnce(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'https://cdn.example.com/copied.png\n', '')
      },
    )

    const manager = new ImageUploadManager(tempDir, {
      execFileFn: execFileMock,
    })
    await manager.initialize()
    await manager.setImageUploadSettings(
      createSettings({
        keepLocalCopyAfterUpload: false,
      }),
    )

    const documentPath = path.join(tempDir, 'note.md')
    const ingestResult = await manager.ingestImage({
      fileName: 'copied.png',
      mimeType: 'image/png',
      documentFilePath: documentPath,
      data: new Uint8Array([9, 9, 9]),
    })

    const successResult = await manager.uploadImage({
      filePath: ingestResult.localFilePath,
      documentFilePath: documentPath,
    })
    expect(successResult.success).toBe(true)
    expect(fs.existsSync(ingestResult.localFilePath)).toBe(false)

    execFileMock.mockImplementationOnce(
      (
        _file: string,
        _args: string[],
        _options: object,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const error = Object.assign(new Error('Command timed out after 5000ms'), {
          killed: true,
        })
        callback(error, '', '')
      },
    )

    const timeoutResult = await manager.uploadImage({
      filePath: path.join(tempDir, 'assets', 'timeout.png'),
      documentFilePath: documentPath,
    })

    expect(timeoutResult).toEqual({
      success: false,
      timedOut: true,
      error: 'Command timed out after 5000ms',
    })
  })
})
