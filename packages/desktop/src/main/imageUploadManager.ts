import { execFile, type ExecFileException, type ExecFileOptions } from 'child_process'
import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type {
  MarkFlowImageIngestRequest,
  MarkFlowImageIngestResult,
  MarkFlowImageUploadRequest,
  MarkFlowImageUploadResult,
  MarkFlowImageUploadSettings,
} from '@markflow/shared'

type PersistedImageUploadSettings = Partial<MarkFlowImageUploadSettings>

type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: ExecFileOptions,
  callback: (error: ExecFileException | null, stdout: string, stderr: string) => void,
) => void

interface ImageUploadManagerOptions {
  execFileFn?: ExecFileFn
}

const DEFAULT_IMAGE_UPLOAD_SETTINGS: MarkFlowImageUploadSettings = {
  autoUploadOnInsert: false,
  uploaderKind: 'disabled',
  command: 'picgo',
  arguments: 'upload',
  timeoutMs: 15_000,
  assetDirectoryName: 'assets',
  keepLocalCopyAfterUpload: true,
}

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
}

function stripForbiddenPathCharacters(value: string) {
  let nextValue = ''
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31) {
      continue
    }

    if ('<>:"/\\|?*'.includes(char)) {
      nextValue += '-'
      continue
    }

    nextValue += char
  }

  return nextValue
}

function sanitizeAssetDirectoryName(value: string | undefined) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return DEFAULT_IMAGE_UPLOAD_SETTINGS.assetDirectoryName
  }

  const sanitized = stripForbiddenPathCharacters(trimmed).replace(/\.+/g, '.')
  const normalized = sanitized.replace(/^\.+|\.+$/g, '').trim()
  return normalized || DEFAULT_IMAGE_UPLOAD_SETTINGS.assetDirectoryName
}

function normalizeTimeout(value: number | undefined) {
  if (!Number.isFinite(value) || (value ?? 0) < 1_000) {
    return DEFAULT_IMAGE_UPLOAD_SETTINGS.timeoutMs
  }

  return Math.round(value as number)
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function normalizeSettings(
  value: PersistedImageUploadSettings | null | undefined,
): MarkFlowImageUploadSettings {
  const uploaderKind =
    value?.uploaderKind === 'picgo-core' || value?.uploaderKind === 'custom-command'
      ? value.uploaderKind
      : 'disabled'
  const defaultCommand =
    uploaderKind === 'disabled'
      ? DEFAULT_IMAGE_UPLOAD_SETTINGS.command
      : normalizeString(value?.command, DEFAULT_IMAGE_UPLOAD_SETTINGS.command)
  const defaultArguments =
    uploaderKind === 'picgo-core'
      ? normalizeString(value?.arguments, DEFAULT_IMAGE_UPLOAD_SETTINGS.arguments)
      : normalizeString(value?.arguments, '')

  return {
    autoUploadOnInsert: normalizeBoolean(
      value?.autoUploadOnInsert,
      DEFAULT_IMAGE_UPLOAD_SETTINGS.autoUploadOnInsert,
    ),
    uploaderKind,
    command: defaultCommand.trim(),
    arguments: defaultArguments.trim(),
    timeoutMs: normalizeTimeout(value?.timeoutMs),
    assetDirectoryName: sanitizeAssetDirectoryName(value?.assetDirectoryName),
    keepLocalCopyAfterUpload: normalizeBoolean(
      value?.keepLocalCopyAfterUpload,
      DEFAULT_IMAGE_UPLOAD_SETTINGS.keepLocalCopyAfterUpload,
    ),
  }
}

function toPosixPath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function ensureRelativeMarkdownPath(filePath: string) {
  const normalized = toPosixPath(filePath)
  if (normalized.startsWith('../') || normalized.startsWith('./')) {
    return normalized
  }

  return `./${normalized}`
}

function isUrlLike(value: string) {
  return /^(https?:\/\/|file:\/\/|\/\/)/i.test(value)
}

function extractRemoteUrl(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (isUrlLike(lines[index])) {
      return lines[index]
    }
  }

  return null
}

function substituteTemplate(value: string, documentFilePath: string | null) {
  const filePath = documentFilePath ?? ''
  const fileName = filePath ? path.basename(filePath) : ''
  return value.replaceAll('${filepath}', filePath).replaceAll('${filename}', fileName)
}

function parseCommandArguments(value: string) {
  const args: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of value) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaping) {
    current += '\\'
  }
  if (current.length > 0) {
    args.push(current)
  }

  return args
}

function sanitizeBaseName(fileName: string, mimeType: string) {
  const rawBaseName = path.basename(fileName).trim() || 'image'
  const extension = path.extname(rawBaseName)
  const stem = rawBaseName.slice(0, extension.length > 0 ? -extension.length : undefined)
  const safeStem = stripForbiddenPathCharacters(stem).replace(/\s+/g, '-').trim() || 'image'
  const safeExtension =
    extension.length > 0
      ? stripForbiddenPathCharacters(extension).replace(/-/g, '').toLowerCase()
      : IMAGE_EXTENSION_BY_MIME[mimeType.toLowerCase()] ?? '.png'

  return `${safeStem}${safeExtension.startsWith('.') ? safeExtension : `.${safeExtension}`}`
}

async function pathExists(filePath: string) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function allocateUniquePath(directory: string, fileName: string) {
  const extension = path.extname(fileName)
  const stem = fileName.slice(0, extension.length > 0 ? -extension.length : undefined)

  let counter = 0
  while (true) {
    const suffix = counter === 0 ? '' : `-${counter + 1}`
    const candidate = path.join(directory, `${stem}${suffix}${extension}`)
    if (!(await pathExists(candidate))) {
      return candidate
    }
    counter += 1
  }
}

function isTimeoutError(error: ExecFileException | null) {
  if (!error) {
    return false
  }

  return error.killed === true && /timed? ?out/i.test(error.message)
}

export class ImageUploadManager {
  private readonly stateDir: string
  private readonly settingsPath: string
  private readonly stagingDir: string
  private readonly execFileFn: ExecFileFn
  private settings: MarkFlowImageUploadSettings = { ...DEFAULT_IMAGE_UPLOAD_SETTINGS }

  constructor(
    userDataPath: string,
    options: ImageUploadManagerOptions = {},
  ) {
    this.stateDir = path.join(userDataPath, 'image-upload')
    this.settingsPath = path.join(this.stateDir, 'image-upload-settings.json')
    this.stagingDir = path.join(this.stateDir, 'staged')
    this.execFileFn = options.execFileFn ?? (execFile as unknown as ExecFileFn)
  }

  registerIpcHandlers() {
    ipcMain.removeHandler('get-image-upload-settings')
    ipcMain.removeHandler('set-image-upload-settings')
    ipcMain.removeHandler('ingest-image')
    ipcMain.removeHandler('upload-image')

    ipcMain.handle('get-image-upload-settings', () => this.getImageUploadSettings())
    ipcMain.handle(
      'set-image-upload-settings',
      async (_event, settings: MarkFlowImageUploadSettings) => this.setImageUploadSettings(settings),
    )
    ipcMain.handle('ingest-image', async (_event, request: MarkFlowImageIngestRequest) =>
      this.ingestImage(request),
    )
    ipcMain.handle('upload-image', async (_event, request: MarkFlowImageUploadRequest) =>
      this.uploadImage(request),
    )
  }

  async initialize() {
    await fs.promises.mkdir(this.stateDir, { recursive: true })
    await fs.promises.mkdir(this.stagingDir, { recursive: true })
    this.settings = normalizeSettings(await this.readPersistedSettings())
    await this.persistSettings()
  }

  getImageUploadSettings() {
    return { ...this.settings }
  }

  async setImageUploadSettings(settings: MarkFlowImageUploadSettings) {
    this.settings = normalizeSettings(settings)
    await this.persistSettings()
    return this.getImageUploadSettings()
  }

  async ingestImage(request: MarkFlowImageIngestRequest): Promise<MarkFlowImageIngestResult> {
    const destinationDir = request.documentFilePath
      ? path.join(path.dirname(request.documentFilePath), this.settings.assetDirectoryName)
      : this.stagingDir
    const normalizedFileName = sanitizeBaseName(request.fileName, request.mimeType)

    await fs.promises.mkdir(destinationDir, { recursive: true })
    const destinationPath = await allocateUniquePath(destinationDir, normalizedFileName)

    if (request.sourcePath) {
      await fs.promises.copyFile(request.sourcePath, destinationPath)
    } else if (request.data && request.data.byteLength > 0) {
      await fs.promises.writeFile(destinationPath, Buffer.from(request.data))
    } else {
      throw new Error('No image data was provided for ingestion.')
    }

    const markdownSource = request.documentFilePath
      ? ensureRelativeMarkdownPath(path.relative(path.dirname(request.documentFilePath), destinationPath))
      : destinationPath

    return {
      localFilePath: destinationPath,
      markdownSource,
    }
  }

  async uploadImage(request: MarkFlowImageUploadRequest): Promise<MarkFlowImageUploadResult> {
    if (
      this.settings.uploaderKind === 'disabled' ||
      (!this.settings.autoUploadOnInsert && !request.manual)
    ) {
      return {
        success: false,
        error: 'Image uploader is disabled.',
      }
    }

    const command = substituteTemplate(
      this.settings.command || DEFAULT_IMAGE_UPLOAD_SETTINGS.command,
      request.documentFilePath,
    ).trim()
    if (!command) {
      return {
        success: false,
        error: 'Image uploader command is empty.',
      }
    }

    const argumentsTemplate =
      this.settings.uploaderKind === 'picgo-core' && this.settings.arguments.trim().length === 0
        ? DEFAULT_IMAGE_UPLOAD_SETTINGS.arguments
        : this.settings.arguments
    const args = parseCommandArguments(
      substituteTemplate(argumentsTemplate, request.documentFilePath),
    )
    if (this.settings.uploaderKind === 'picgo-core' && args.length === 0) {
      args.push('upload')
    }
    args.push(request.filePath)

    try {
      const { stdout, stderr } = await this.runCommand(command, args, {
        cwd: request.documentFilePath ? path.dirname(request.documentFilePath) : this.stateDir,
        timeout: this.settings.timeoutMs,
      })
      const remoteUrl = extractRemoteUrl(stdout)
      if (!remoteUrl) {
        return {
          success: false,
          error: stderr.trim() || 'Failed to parse result image path from uploader output.',
        }
      }

      if (!this.settings.keepLocalCopyAfterUpload) {
        await this.removeManagedLocalCopy(request.filePath)
      }

      return {
        success: true,
        remoteUrl,
      }
    } catch (error) {
      const uploadError = error as ExecFileException
      return {
        success: false,
        timedOut: isTimeoutError(uploadError),
        error:
          uploadError.stderr?.toString().trim() ||
          uploadError.message ||
          'Image upload failed.',
      }
    }
  }

  private async removeManagedLocalCopy(filePath: string) {
    if (!filePath.startsWith(this.stateDir) && !filePath.includes(`${path.sep}${this.settings.assetDirectoryName}${path.sep}`)) {
      return
    }

    try {
      await fs.promises.unlink(filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  private runCommand(file: string, args: string[], options: ExecFileOptions) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      this.execFileFn(file, args, options, (error, stdout, stderr) => {
        if (error) {
          const nextError = error as ExecFileException & { stderr?: string }
          nextError.stderr = stderr
          reject(nextError)
          return
        }

        resolve({ stdout, stderr })
      })
    })
  }

  private async readPersistedSettings() {
    try {
      const raw = await fs.promises.readFile(this.settingsPath, 'utf8')
      return JSON.parse(raw) as PersistedImageUploadSettings
    } catch {
      return null
    }
  }

  private async persistSettings() {
    await fs.promises.mkdir(this.stateDir, { recursive: true })
    await fs.promises.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8')
  }
}
