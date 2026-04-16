import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { StringDecoder } from 'string_decoder'
const execFileAsync = promisify(execFile)
import * as path from 'path'
import type {
  MarkFlowTabCloseAction,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowQuickOpenItem,
  MarkFlowRecoveryCheckpoint,
  MarkFlowRecoveryDocument,
  MarkFlowRecoveryDraft,
  MarkFlowSaveResult,
  MarkFlowWindowSession,
  MarkFlowWindowSessionState,
  SearchResult,
} from '@markflow/shared'

const STREAM_OPEN_CHUNK_SIZE = 64 * 1024
const STREAM_OPEN_THRESHOLD_BYTES = 1024 * 1024
const STREAM_PREVIEW_BYTE_LIMIT = 64 * 1024
const WINDOWED_OPEN_THRESHOLD_BYTES = 256 * 1024 * 1024
const WINDOWED_READ_CHUNK_SIZE = 256 * 1024
const WINDOWED_PROGRESS_INTERVAL_BYTES = 4 * 1024 * 1024
const WINDOWED_LINE_CHECKPOINT_INTERVAL = 2048
const WINDOWED_LINE_WINDOW_SIZE = 400
const WINDOWED_LINE_CONTEXT_BEFORE = 40
const RECOVERY_CHECKPOINT_DELAY_MS = 30_000
const RECOVERY_CHECKPOINT_FILE_NAME = '.markflow-recovery'
const SESSION_STATE_FILE_NAME = '.markflow-recovery-session.json'
const WINDOW_SESSION_FILE_NAME = '.markflow-window-session.json'
const FOLD_STATE_FILE_SUFFIX = '.folds'

interface MarkFlowSessionState {
  cleanExit: boolean
}

interface FileManagerOptions {
  windowedLineCheckpointInterval: number
  windowedLineContextBefore: number
  windowedLineWindowSize: number
  windowedOpenThresholdBytes: number
  windowedProgressIntervalBytes: number
  windowedReadChunkSize: number
}

interface MarkFlowLargeFileCheckpoint {
  lineNumber: number
  byteOffset: number
}

interface MarkFlowLargeFileIndex {
  filePath: string
  totalBytes: number
  totalLines: number
  mtimeMs: number
  checkpoints: MarkFlowLargeFileCheckpoint[]
  lastWindow: MarkFlowFilePayload | null
}

const DEFAULT_FILE_MANAGER_OPTIONS: FileManagerOptions = {
  windowedLineCheckpointInterval: WINDOWED_LINE_CHECKPOINT_INTERVAL,
  windowedLineContextBefore: WINDOWED_LINE_CONTEXT_BEFORE,
  windowedLineWindowSize: WINDOWED_LINE_WINDOW_SIZE,
  windowedOpenThresholdBytes: WINDOWED_OPEN_THRESHOLD_BYTES,
  windowedProgressIntervalBytes: WINDOWED_PROGRESS_INTERVAL_BYTES,
  windowedReadChunkSize: WINDOWED_READ_CHUNK_SIZE,
}

export class FileManager {
  private currentFilePath: string | null = null
  private recentFiles: string[] = []
  private pendingRecoveryDraft: MarkFlowRecoveryDraft | null = null
  private recoveryWriteTimer: NodeJS.Timeout | null = null
  private readonly largeFileIndexes = new Map<string, MarkFlowLargeFileIndex>()
  private readonly options: FileManagerOptions
  private readonly recoveryCheckpointPath = path.join(app.getPath('temp'), RECOVERY_CHECKPOINT_FILE_NAME)
  private readonly sessionStatePath = path.join(app.getPath('userData'), SESSION_STATE_FILE_NAME)
  private readonly windowSessionPath = path.join(app.getPath('userData'), WINDOW_SESSION_FILE_NAME)

  constructor(
    private window: BrowserWindow,
    private onCurrentFilePathChanged?: () => void,
    options: Partial<FileManagerOptions> = {},
  ) {
    this.options = {
      ...DEFAULT_FILE_MANAGER_OPTIONS,
      ...options,
    }
  }

  registerIpcHandlers() {
    ipcMain.removeHandler('open-file')
    ipcMain.removeHandler('open-path')
    ipcMain.removeHandler('read-large-file-window')
    ipcMain.removeHandler('save-file')
    ipcMain.removeHandler('save-file-as')
    ipcMain.removeHandler('get-fold-state')
    ipcMain.removeHandler('save-fold-state')
    ipcMain.removeHandler('new-file')
    ipcMain.removeHandler('get-current-path')
    ipcMain.removeHandler('get-current-document')
    ipcMain.removeHandler('get-recovery-checkpoint')
    ipcMain.removeHandler('discard-recovery-checkpoint')
    ipcMain.removeHandler('get-quick-open-list')
    ipcMain.removeHandler('get-window-session')
    ipcMain.removeHandler('save-window-session')
    ipcMain.removeHandler('confirm-close-tab')
    ipcMain.removeHandler('open-folder')
    ipcMain.removeHandler('get-vault-files')
    ipcMain.removeHandler('rename-file')
    ipcMain.removeHandler('delete-file')
    ipcMain.removeHandler('search-files')
    ipcMain.removeHandler('export-html')
    ipcMain.removeHandler('export-pdf')
    ipcMain.removeHandler('export-docx')
    ipcMain.removeHandler('export-epub')
    ipcMain.removeHandler('export-latex')
    ipcMain.removeAllListeners('schedule-recovery-checkpoint')

    ipcMain.handle('open-file', () => this.openFile())
    ipcMain.handle('open-path', (_event, filePath: string) => this.openExistingPath(filePath))
    ipcMain.handle('read-large-file-window', (_event, filePath: string, lineNumber: number) =>
      this.readLargeFileWindow(filePath, lineNumber),
    )
    ipcMain.handle('save-file', async (_event, content: string, tabId: string | null) =>
      this.saveFile(content, tabId),
    )
    ipcMain.handle('save-file-as', async (_event, content: string, tabId: string | null) =>
      this.saveFileAs(content, tabId),
    )
    ipcMain.handle('get-fold-state', async (_event, filePath: string) => this.getFoldState(filePath))
    ipcMain.handle('save-fold-state', async (_event, filePath: string, ranges: number[]) => {
      await this.saveFoldState(filePath, ranges)
    })
    ipcMain.handle('new-file', () => this.newFile())
    ipcMain.handle('get-current-path', () => this.currentFilePath)
    ipcMain.handle('get-current-document', () => this.getCurrentDocument())
    ipcMain.handle('get-window-session', () => this.getWindowSession())
    ipcMain.handle('save-window-session', async (_event, session: MarkFlowWindowSessionState) => {
      await this.saveWindowSession(session)
    })
    ipcMain.handle('confirm-close-tab', async (_event, documentName: string) =>
      this.confirmTabClose(documentName),
    )
    ipcMain.on('schedule-recovery-checkpoint', (_event, draft: MarkFlowRecoveryDraft) => {
      this.scheduleRecoveryCheckpoint(draft)
    })
    ipcMain.handle('get-recovery-checkpoint', () => this.getRecoveryCheckpoint())
    ipcMain.handle('discard-recovery-checkpoint', async () => {
      await this.discardRecoveryCheckpoint()
    })
    ipcMain.handle('get-quick-open-list', () => this.getQuickOpenList())
    ipcMain.handle('open-folder', () => this.openFolder())
    ipcMain.handle('get-vault-files', (_event, folderPath: string) => this.getVaultFiles(folderPath))
    ipcMain.handle('rename-file', (_event, oldPath: string, newPath: string) => this.renameFile(oldPath, newPath))
    ipcMain.handle('delete-file', (_event, filePath: string) => this.deleteFile(filePath))
    ipcMain.handle('search-files', (_event, folderPath: string, query: string) => this.searchFiles(folderPath, query))
    ipcMain.handle('export-html', async (_event, html: string, defaultPath: string) => this.exportHtml(html, defaultPath))
    ipcMain.handle('export-pdf', async (_event, html: string, defaultPath: string) => this.exportPdf(html, defaultPath))
    ipcMain.handle('export-docx', async (_event, markdown: string, defaultPath: string) => this.exportPandoc(markdown, defaultPath, 'docx', 'Word Document', ['docx']))
    ipcMain.handle('export-epub', async (_event, markdown: string, defaultPath: string) => this.exportPandoc(markdown, defaultPath, 'epub', 'EPUB', ['epub']))
    ipcMain.handle('export-latex', async (_event, markdown: string, defaultPath: string) => this.exportPandoc(markdown, defaultPath, 'latex', 'LaTeX', ['tex']))
  }

  markSessionStarted() {
    void this.writeSessionState({ cleanExit: false })
  }

  markSessionClosed() {
    void this.writeSessionState({ cleanExit: true })
  }

  dispose() {
    this.clearRecoveryCheckpointTimer()
  }

  
  async exportHtml(html: string, defaultPath: string): Promise<boolean> {
    const result = await dialog.showSaveDialog(this.window, {
      title: 'Export as HTML',
      defaultPath,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (result.canceled || !result.filePath) return false

    try {
      await fs.promises.writeFile(result.filePath, html, 'utf-8')
      return true
    } catch (e) {
      console.error('Failed to export HTML:', e)
      return false
    }
  }

  async exportPdf(html: string, defaultPath: string): Promise<boolean> {
    const result = await dialog.showSaveDialog(this.window, {
      title: 'Export as PDF',
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return false

    // Create a hidden window to render the HTML and print to PDF
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    })

    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'default' }
      })
      await fs.promises.writeFile(result.filePath, pdfData)
      return true
    } catch (e) {
      console.error('Failed to export PDF:', e)
      return false
    } finally {
      win.destroy()
    }
  }


  async exportPandoc(markdown: string, defaultPath: string, format: string, filterName: string, extensions: string[]): Promise<boolean> {
    const result = await dialog.showSaveDialog(this.window, {
      title: `Export as ${filterName}`,
      defaultPath,
      filters: [{ name: filterName, extensions }],
    })
    if (result.canceled || !result.filePath) return false

    const tempDir = app.getPath('temp')
    const tempFile = path.join(tempDir, `markflow-export-${Date.now()}-${Math.random().toString(36).substring(7)}.md`)

    try {
      await fs.promises.writeFile(tempFile, markdown, 'utf-8')
      const args = [tempFile, '-o', result.filePath]
      if (format === 'latex') {
        args.push('--standalone')
      }
      await execFileAsync('pandoc', args)
      return true
    } catch (e) {
      console.error(`Failed to export ${format}:`, e)
      return false
    } finally {
      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile)
        }
      } catch (err) {
        console.error('Failed to cleanup temp file', err)
      }
    }
  }

  private addToRecent(filePath: string) {
    this.recentFiles = this.recentFiles.filter(p => p !== filePath)
    this.recentFiles.unshift(filePath)
    if (this.recentFiles.length > 20) {
      this.recentFiles = this.recentFiles.slice(0, 20)
    }
  }

  async newFile() {
    this.currentFilePath = null
    this.onCurrentFilePathChanged?.()
    this.window.webContents.send('file-opened', { filePath: null, content: '' })
    this.updateTitle()
  }

  async openFile() {
    const result = await dialog.showOpenDialog(this.window, {
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    return this.openPath(result.filePaths[0])
  }

  async openExistingPath(filePath: string): Promise<MarkFlowFilePayload | null> {
    if (!fs.existsSync(filePath)) {
      return null
    }

    return this.openPath(filePath)
  }

  async saveFile(content?: string, tabId: string | null = null): Promise<MarkFlowSaveResult | null> {
    if (!this.currentFilePath) {
      return this.saveFileAs(content, tabId)
    }

    const saveResult = await this.writeFile(this.currentFilePath, content ?? '')
    if (saveResult.success) {
      await this.removeRecoveryDocument(tabId)
      this.emitFileSaved(this.currentFilePath)
      saveResult.filePath = this.currentFilePath
    }
    return saveResult
  }

  async saveFileAs(content?: string, tabId: string | null = null): Promise<MarkFlowSaveResult | null> {
    const result = await dialog.showSaveDialog(this.window, {
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      defaultPath: this.currentFilePath ?? 'untitled.md',
    })

    if (result.canceled || !result.filePath) return null

    const saveResult = await this.writeFile(result.filePath, content ?? '')
    if (saveResult.success) {
      this.currentFilePath = result.filePath
      this.addToRecent(result.filePath)
      this.onCurrentFilePathChanged?.()
      await this.removeRecoveryDocument(tabId)
      this.emitFileSaved(result.filePath)
      saveResult.filePath = result.filePath
    }
    return saveResult
  }

  async openPath(filePath: string): Promise<MarkFlowFilePayload> {
    const payload = await this.readFileForOpen(filePath)
    this.currentFilePath = filePath
    this.addToRecent(filePath)
    this.onCurrentFilePathChanged?.()
    this.window.webContents.send('file-opened', payload)
    this.updateTitle()
    return payload
  }

  async readLargeFileWindow(filePath: string, lineNumber: number): Promise<MarkFlowFilePayload | null> {
    if (!fs.existsSync(filePath)) {
      return null
    }

    const stats = await fs.promises.stat(filePath)
    if (stats.size < this.options.windowedOpenThresholdBytes) {
      return this.readFileForOpen(filePath)
    }

    return this.readWindowedLargeFilePayload(filePath, stats, lineNumber)
  }

  async getFoldState(filePath: string): Promise<number[]> {
    try {
      const payload = JSON.parse(
        await fs.promises.readFile(this.getFoldStatePath(filePath), 'utf-8'),
      ) as unknown

      if (!Array.isArray(payload)) {
        return []
      }
      if (payload.length % 2 !== 0) {
        return []
      }

      const ranges: number[] = []
      for (let index = 0; index + 1 < payload.length; index += 2) {
        const from = payload[index]
        const to = payload[index + 1]
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to) {
          return []
        }
        ranges.push(from, to)
      }

      return ranges
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read MarkFlow fold state:', error)
      }
      return []
    }
  }

  async saveFoldState(filePath: string, ranges: number[]) {
    const foldStatePath = this.getFoldStatePath(filePath)
    const normalizedRanges: number[] = []

    for (let index = 0; index + 1 < ranges.length; index += 2) {
      const from = ranges[index]
      const to = ranges[index + 1]
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to) {
        continue
      }
      normalizedRanges.push(from, to)
    }

    if (normalizedRanges.length === 0) {
      try {
        await fs.promises.unlink(foldStatePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.error('Failed to discard MarkFlow fold state:', error)
        }
      }
      return
    }

    try {
      await fs.promises.writeFile(foldStatePath, JSON.stringify(normalizedRanges), 'utf-8')
    } catch (error) {
      console.error('Failed to write MarkFlow fold state:', error)
    }
  }

  canRevealCurrentFile(): boolean {
    return this.currentFilePath !== null
  }

  revealCurrentFileInFolder(): boolean {
    if (!this.currentFilePath) {
      return false
    }

    shell.showItemInFolder(this.currentFilePath)
    return true
  }

  async getCurrentDocument(): Promise<MarkFlowFilePayload | null> {
    if (!this.currentFilePath || !fs.existsSync(this.currentFilePath)) {
      return null
    }

    return this.readFileForOpen(this.currentFilePath)
  }

  async getWindowSession(): Promise<MarkFlowWindowSession | null> {
    const session = await this.readWindowSessionState()
    if (!session || session.filePaths.length === 0) {
      return null
    }

    const documents: MarkFlowFilePayload[] = []
    for (const filePath of session.filePaths) {
      if (!fs.existsSync(filePath)) {
        continue
      }

      documents.push(await this.readFileForOpen(filePath))
    }

    if (documents.length === 0) {
      this.currentFilePath = null
      this.onCurrentFilePathChanged?.()
      this.updateTitle()
      return null
    }

    const nextActiveFilePath =
      session.activeFilePath && documents.some((document) => document.filePath === session.activeFilePath)
        ? session.activeFilePath
        : documents[0].filePath
    this.currentFilePath = nextActiveFilePath
    this.onCurrentFilePathChanged?.()
    this.updateTitle()

    return {
      documents,
      activeFilePath: nextActiveFilePath,
    }
  }

  async saveWindowSession(session: MarkFlowWindowSessionState) {
    const normalizedFilePaths = session.filePaths.filter((filePath, index, filePaths) => {
      return typeof filePath === 'string' && filePath.length > 0 && filePaths.indexOf(filePath) === index
    })
    const activeFilePath =
      session.activeFilePath && normalizedFilePaths.includes(session.activeFilePath)
        ? session.activeFilePath
        : normalizedFilePaths[0] ?? null

    try {
      await fs.promises.mkdir(path.dirname(this.windowSessionPath), { recursive: true })
      await fs.promises.writeFile(
        this.windowSessionPath,
        JSON.stringify({
          filePaths: normalizedFilePaths,
          activeFilePath,
        } satisfies MarkFlowWindowSessionState),
        'utf-8',
      )
    } catch (error) {
      console.error('Failed to write MarkFlow window session state:', error)
    }

    this.currentFilePath = activeFilePath
    this.onCurrentFilePathChanged?.()
    this.updateTitle()
  }

  async confirmTabClose(documentName: string): Promise<MarkFlowTabCloseAction> {
    const result = await dialog.showMessageBox(this.window, {
      type: 'warning',
      buttons: ['Save', 'Discard', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      message: `Save changes to ${documentName}?`,
      detail: 'Your unsaved changes will be lost if you discard them.',
    })

    if (result.response === 0) {
      return 'save'
    }

    if (result.response === 1) {
      return 'discard'
    }

    return 'cancel'
  }

  scheduleRecoveryCheckpoint(draft: MarkFlowRecoveryDraft) {
    this.pendingRecoveryDraft = this.normalizeRecoveryDraft(draft)
    if (this.pendingRecoveryDraft.documents.length === 0) {
      void this.discardRecoveryCheckpoint()
      return
    }

    this.clearRecoveryCheckpointTimer()
    this.recoveryWriteTimer = setTimeout(() => {
      const nextDraft = this.pendingRecoveryDraft
      this.pendingRecoveryDraft = null
      this.recoveryWriteTimer = null

      if (!nextDraft) {
        return
      }

      void this.writeRecoveryCheckpoint(nextDraft)
    }, RECOVERY_CHECKPOINT_DELAY_MS)
  }

  async getRecoveryCheckpoint(): Promise<MarkFlowRecoveryCheckpoint | null> {
    if (!(await this.shouldSurfaceRecoveryCheckpoint())) {
      return null
    }

    try {
      const payload = JSON.parse(
        await fs.promises.readFile(this.recoveryCheckpointPath, 'utf-8'),
      ) as Partial<MarkFlowRecoveryCheckpoint> &
        Partial<MarkFlowRecoveryDocument> & { activeTabId?: unknown; documents?: unknown; savedAt?: unknown }

      return this.normalizeRecoveryCheckpointPayload(payload)
    } catch {
      return null
    }
  }

  async discardRecoveryCheckpoint() {
    this.pendingRecoveryDraft = null
    this.clearRecoveryCheckpointTimer()

    try {
      await fs.promises.unlink(this.recoveryCheckpointPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to discard MarkFlow recovery checkpoint:', error)
      }
    }
  }

  async getQuickOpenList(): Promise<MarkFlowQuickOpenItem[]> {
    const items: MarkFlowQuickOpenItem[] = []
    const seen = new Set<string>()

    if (this.currentFilePath) {
      const dir = path.dirname(this.currentFilePath)
      try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true })
        for (const file of files) {
          if (file.isFile() && /.(md|markdown|txt)$/i.test(file.name)) {
            const filePath = path.join(dir, file.name)
            if (!seen.has(filePath)) {
              seen.add(filePath)
              items.push({
                id: filePath,
                label: file.name,
                description: dir,
                filePath,
                isRecent: false
              })
            }
          }
        }
      } catch {
        // Ignore directory read errors
      }
    }

    for (const recentPath of this.recentFiles) {
      if (!seen.has(recentPath)) {
        seen.add(recentPath)
        items.push({
          id: recentPath,
          label: path.basename(recentPath),
          description: path.dirname(recentPath),
          filePath: recentPath,
          isRecent: true
        })
      }
    }

    return items
  }

  async openFolder(): Promise<{ folderPath: string } | null> {
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return { folderPath: result.filePaths[0] }
  }

  getVaultFiles(folderPath: string): string[] {
    const results: string[] = []
    const walk = (dir: string) => {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && /\.(md|markdown|txt)$/i.test(entry.name)) {
          results.push(fullPath)
        }
      }
    }
    walk(folderPath)
    return results.sort()
  }

  renameFile(oldPath: string, newPath: string): void {
    fs.renameSync(oldPath, newPath)
  }

  deleteFile(filePath: string): void {
    fs.unlinkSync(filePath)
  }

  searchFiles(folderPath: string, query: string): SearchResult[] {
    if (!query.trim()) return []
    const files = this.getVaultFiles(folderPath)
    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    for (const filePath of files) {
      let content: string
      try {
        content = fs.readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }
      const lines = content.split('\n')
      lines.forEach((lineText, idx) => {
        const lowerLine = lineText.toLowerCase()
        let searchFrom = 0
        let matchIdx: number
        while ((matchIdx = lowerLine.indexOf(lowerQuery, searchFrom)) !== -1) {
          results.push({
            filePath,
            lineNumber: idx + 1,
            lineText,
            matchStart: matchIdx,
            matchEnd: matchIdx + query.length,
          })
          searchFrom = matchIdx + 1
        }
      })
    }
    return results
  }

  private getFoldStatePath(filePath: string) {
    return `${filePath}${FOLD_STATE_FILE_SUFFIX}`
  }

  private updateTitle() {
    const name = this.currentFilePath
      ? path.basename(this.currentFilePath)
      : 'Untitled'
    this.window.setTitle(`${name} — MarkFlow`)
    if (this.currentFilePath) {
      this.window.setRepresentedFilename(this.currentFilePath)
    } else {
      this.window.setRepresentedFilename('')
    }
  }

  private async writeFile(filePath: string, content: string): Promise<MarkFlowSaveResult> {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private emitFileSaved(filePath: string) {
    this.window.webContents.send('file-saved', { filePath })
    this.updateTitle()
  }

  private clearRecoveryCheckpointTimer() {
    if (this.recoveryWriteTimer) {
      clearTimeout(this.recoveryWriteTimer)
      this.recoveryWriteTimer = null
    }
  }

  private async shouldSurfaceRecoveryCheckpoint() {
    const sessionState = await this.readSessionState()
    return sessionState?.cleanExit === false && fs.existsSync(this.recoveryCheckpointPath)
  }

  private async readSessionState(): Promise<MarkFlowSessionState | null> {
    try {
      const payload = JSON.parse(
        await fs.promises.readFile(this.sessionStatePath, 'utf-8'),
      ) as Partial<MarkFlowSessionState>

      if (typeof payload.cleanExit !== 'boolean') {
        return null
      }

      return { cleanExit: payload.cleanExit }
    } catch {
      return null
    }
  }

  private async readWindowSessionState(): Promise<MarkFlowWindowSessionState | null> {
    try {
      const payload = JSON.parse(
        await fs.promises.readFile(this.windowSessionPath, 'utf-8'),
      ) as Partial<MarkFlowWindowSessionState>

      if (!Array.isArray(payload.filePaths)) {
        return null
      }
      if (payload.activeFilePath !== null && typeof payload.activeFilePath !== 'string') {
        return null
      }

      const filePaths = payload.filePaths.filter((filePath): filePath is string => typeof filePath === 'string')
      return {
        filePaths,
        activeFilePath: payload.activeFilePath ?? null,
      }
    } catch {
      return null
    }
  }

  private normalizeRecoveryDocument(payload: Partial<MarkFlowRecoveryDocument>): MarkFlowRecoveryDocument | null {
    if (typeof payload.tabId !== 'string' || payload.tabId.length === 0 || typeof payload.content !== 'string') {
      return null
    }

    if (payload.filePath !== null && payload.filePath !== undefined && typeof payload.filePath !== 'string') {
      return null
    }

    return {
      tabId: payload.tabId,
      filePath: payload.filePath ?? null,
      content: payload.content,
    }
  }

  private normalizeRecoveryDraft(draft: MarkFlowRecoveryDraft): MarkFlowRecoveryDraft {
    const documents = draft.documents
      .map((document) => this.normalizeRecoveryDocument(document))
      .filter((document): document is MarkFlowRecoveryDocument => document !== null)
    const activeTabId =
      typeof draft.activeTabId === 'string' && documents.some((document) => document.tabId === draft.activeTabId)
        ? draft.activeTabId
        : null

    return { activeTabId, documents }
  }

  private normalizeRecoveryCheckpointPayload(
    payload: Partial<MarkFlowRecoveryCheckpoint> &
      Partial<MarkFlowRecoveryDocument> & { activeTabId?: unknown; documents?: unknown; savedAt?: unknown },
  ): MarkFlowRecoveryCheckpoint | null {
    if (typeof payload.savedAt !== 'string') {
      return null
    }

    const documents = Array.isArray(payload.documents)
      ? payload.documents
          .map((document) =>
            this.normalizeRecoveryDocument(document as Partial<MarkFlowRecoveryDocument>),
          )
          .filter((document): document is MarkFlowRecoveryDocument => document !== null)
      : typeof payload.content === 'string'
        ? [
            {
              tabId: 'legacy-recovery',
              filePath: typeof payload.filePath === 'string' ? payload.filePath : null,
              content: payload.content,
            },
          ]
        : []

    if (documents.length === 0) {
      return null
    }

    const activeTabId =
      typeof payload.activeTabId === 'string' && documents.some((document) => document.tabId === payload.activeTabId)
        ? payload.activeTabId
        : null

    return {
      activeTabId,
      documents,
      savedAt: payload.savedAt,
    }
  }

  private pruneRecoveryDraft(draft: MarkFlowRecoveryDraft, tabId: string): MarkFlowRecoveryDraft {
    const documents = draft.documents.filter((document) => document.tabId !== tabId)
    const activeTabId =
      draft.activeTabId === tabId && !documents.some((document) => document.tabId === draft.activeTabId)
        ? null
        : draft.activeTabId

    return {
      activeTabId: activeTabId && documents.some((document) => document.tabId === activeTabId) ? activeTabId : null,
      documents,
    }
  }

  private async readRecoveryCheckpointFile(): Promise<MarkFlowRecoveryCheckpoint | null> {
    try {
      const payload = JSON.parse(
        await fs.promises.readFile(this.recoveryCheckpointPath, 'utf-8'),
      ) as Partial<MarkFlowRecoveryCheckpoint> &
        Partial<MarkFlowRecoveryDocument> & { activeTabId?: unknown; documents?: unknown; savedAt?: unknown }

      return this.normalizeRecoveryCheckpointPayload(payload)
    } catch {
      return null
    }
  }

  private async removeRecoveryDocument(tabId: string | null) {
    if (!tabId) {
      return
    }

    if (this.pendingRecoveryDraft) {
      this.pendingRecoveryDraft = this.pruneRecoveryDraft(this.pendingRecoveryDraft, tabId)
      if (this.pendingRecoveryDraft.documents.length === 0) {
        this.pendingRecoveryDraft = null
        this.clearRecoveryCheckpointTimer()
      }
    }

    try {
      const checkpoint = await this.readRecoveryCheckpointFile()
      if (!checkpoint) {
        return
      }

      const nextCheckpoint = this.pruneRecoveryDraft(checkpoint, tabId)
      if (nextCheckpoint.documents.length === 0) {
        try {
          await fs.promises.unlink(this.recoveryCheckpointPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Failed to update MarkFlow recovery checkpoint:', error)
          }
        }
        return
      }

      await fs.promises.writeFile(
        this.recoveryCheckpointPath,
        JSON.stringify({
          ...nextCheckpoint,
          savedAt: checkpoint.savedAt,
        }),
        'utf-8',
      )
    } catch (error) {
      console.error('Failed to prune MarkFlow recovery checkpoint:', error)
    }
  }

  private async writeSessionState(state: MarkFlowSessionState) {
    try {
      await fs.promises.mkdir(path.dirname(this.sessionStatePath), { recursive: true })
      await fs.promises.writeFile(this.sessionStatePath, JSON.stringify(state), 'utf-8')
    } catch (error) {
      console.error('Failed to update MarkFlow recovery session state:', error)
    }
  }

  private async writeRecoveryCheckpoint(draft: MarkFlowRecoveryDraft) {
    const checkpoint: MarkFlowRecoveryCheckpoint = {
      ...this.normalizeRecoveryDraft(draft),
      savedAt: new Date().toISOString(),
    }

    try {
      await fs.promises.writeFile(this.recoveryCheckpointPath, JSON.stringify(checkpoint), 'utf-8')
    } catch (error) {
      console.error('Failed to write MarkFlow recovery checkpoint:', error)
    }
  }

  private async readFileForOpen(filePath: string): Promise<MarkFlowFilePayload> {
    const stats = await fs.promises.stat(filePath)
    if (stats.size >= this.options.windowedOpenThresholdBytes) {
      return this.readWindowedLargeFilePayload(filePath, stats, 1)
    }
    if (stats.size < STREAM_OPEN_THRESHOLD_BYTES) {
      return {
        filePath,
        content: await fs.promises.readFile(filePath, 'utf-8'),
      }
    }

    return this.readLargeFileForOpen(filePath, stats.size)
  }

  private async readLargeFileForOpen(
    filePath: string,
    totalBytes: number,
  ): Promise<MarkFlowFilePayload> {
    const chunks: Buffer[] = []
    const previewDecoder = new StringDecoder('utf8')
    const stream = fs.createReadStream(filePath, {
      highWaterMark: STREAM_OPEN_CHUNK_SIZE,
    })

    let previewContent = ''
    let bytesRead = 0

    const emitProgress = (done: boolean) => {
      const payload: MarkFlowFileLoadProgressPayload = {
        filePath,
        bytesRead,
        totalBytes,
        previewContent,
        done,
      }
      this.window.webContents.send('file-loading-progress', payload)
    }

    return new Promise<MarkFlowFilePayload>((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        const bufferChunk = typeof chunk === 'string' ? Buffer.from(chunk) : chunk

        chunks.push(bufferChunk)
        bytesRead += bufferChunk.length

        if (previewContent.length < STREAM_PREVIEW_BYTE_LIMIT) {
          previewContent = `${previewContent}${previewDecoder.write(bufferChunk)}`.slice(
            0,
            STREAM_PREVIEW_BYTE_LIMIT,
          )
        }

        emitProgress(false)
      })

      stream.once('error', (error) => {
        reject(error)
      })

      stream.once('end', () => {
        previewContent = `${previewContent}${previewDecoder.end()}`.slice(0, STREAM_PREVIEW_BYTE_LIMIT)
        bytesRead = totalBytes
        emitProgress(true)
        resolve({
          filePath,
          content: Buffer.concat(chunks).toString('utf-8'),
        })
      })
    })
  }

  private async readWindowedLargeFilePayload(
    filePath: string,
    stats: fs.Stats,
    requestedLineNumber: number,
  ): Promise<MarkFlowFilePayload> {
    const index = await this.getLargeFileIndex(filePath, stats)
    const clampedLineNumber = Math.max(1, Math.min(requestedLineNumber, index.totalLines))
    const cachedWindow = index.lastWindow?.largeFile
    if (
      cachedWindow &&
      clampedLineNumber >= cachedWindow.windowStartLine &&
      clampedLineNumber <= cachedWindow.windowEndLine
    ) {
      const lastWindow = index.lastWindow as MarkFlowFilePayload
      const payload: MarkFlowFilePayload = {
        ...lastWindow,
        largeFile: {
          ...cachedWindow,
          anchorLine: clampedLineNumber,
        },
      }
      index.lastWindow = payload
      return payload
    }

    const windowStartLine = this.getWindowStartLine(clampedLineNumber, index.totalLines)
    const windowEndLine = Math.min(
      index.totalLines,
      windowStartLine + this.options.windowedLineWindowSize - 1,
    )
    const startOffset = await this.findLineStartOffset(index, windowStartLine)
    const content = await this.readLargeFileWindowContent(
      index,
      startOffset,
      windowStartLine,
      windowEndLine,
    )
    const payload: MarkFlowFilePayload = {
      filePath,
      content,
      largeFile: {
        totalBytes: index.totalBytes,
        totalLines: index.totalLines,
        windowStartLine,
        windowEndLine,
        anchorLine: clampedLineNumber,
        readOnly: true,
      },
    }
    index.lastWindow = payload
    return payload
  }

  private async getLargeFileIndex(filePath: string, stats: fs.Stats): Promise<MarkFlowLargeFileIndex> {
    const cachedIndex = this.largeFileIndexes.get(filePath)
    if (
      cachedIndex &&
      cachedIndex.totalBytes === stats.size &&
      cachedIndex.mtimeMs === stats.mtimeMs
    ) {
      return cachedIndex
    }

    const fileHandle = await fs.promises.open(filePath, 'r')
    const buffer = Buffer.allocUnsafe(this.options.windowedReadChunkSize)
    const previewDecoder = new StringDecoder('utf8')
    const checkpoints: MarkFlowLargeFileCheckpoint[] = [{ lineNumber: 1, byteOffset: 0 }]

    let previewContent = ''
    let bytesReadTotal = 0
    let lastProgressBytes = 0
    let currentLineNumber = 1
    let nextCheckpointLine = 1 + this.options.windowedLineCheckpointInterval

    const emitProgress = (done: boolean) => {
      const payload: MarkFlowFileLoadProgressPayload = {
        filePath,
        bytesRead: done ? stats.size : bytesReadTotal,
        totalBytes: stats.size,
        previewContent,
        done,
      }
      this.window.webContents.send('file-loading-progress', payload)
    }

    try {
      while (bytesReadTotal < stats.size) {
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          buffer.length,
          bytesReadTotal,
        )
        if (bytesRead === 0) {
          break
        }

        const chunk = buffer.subarray(0, bytesRead)
        if (previewContent.length < STREAM_PREVIEW_BYTE_LIMIT) {
          previewContent = `${previewContent}${previewDecoder.write(chunk)}`.slice(
            0,
            STREAM_PREVIEW_BYTE_LIMIT,
          )
        }

        const chunkStartOffset = bytesReadTotal
        for (let index = 0; index < bytesRead; index += 1) {
          if (chunk[index] !== 10) {
            continue
          }

          currentLineNumber += 1
          if (currentLineNumber === nextCheckpointLine) {
            checkpoints.push({
              lineNumber: currentLineNumber,
              byteOffset: chunkStartOffset + index + 1,
            })
            nextCheckpointLine += this.options.windowedLineCheckpointInterval
          }
        }

        bytesReadTotal += bytesRead
        if (bytesReadTotal - lastProgressBytes >= this.options.windowedProgressIntervalBytes) {
          lastProgressBytes = bytesReadTotal
          emitProgress(false)
        }
      }
    } finally {
      await fileHandle.close()
    }

    previewContent = `${previewContent}${previewDecoder.end()}`.slice(0, STREAM_PREVIEW_BYTE_LIMIT)
    emitProgress(true)

    const nextIndex: MarkFlowLargeFileIndex = {
      filePath,
      totalBytes: stats.size,
      totalLines: currentLineNumber,
      mtimeMs: stats.mtimeMs,
      checkpoints,
      lastWindow: null,
    }
    this.largeFileIndexes.set(filePath, nextIndex)
    return nextIndex
  }

  private getWindowStartLine(anchorLine: number, totalLines: number) {
    const maxStartLine = Math.max(1, totalLines - this.options.windowedLineWindowSize + 1)
    return Math.max(1, Math.min(anchorLine - this.options.windowedLineContextBefore, maxStartLine))
  }

  private async findLineStartOffset(index: MarkFlowLargeFileIndex, targetLine: number) {
    if (targetLine <= 1) {
      return 0
    }

    let checkpoint = index.checkpoints[0]
    for (const candidate of index.checkpoints) {
      if (candidate.lineNumber > targetLine) {
        break
      }
      checkpoint = candidate
    }

    if (checkpoint.lineNumber === targetLine) {
      return checkpoint.byteOffset
    }

    const fileHandle = await fs.promises.open(index.filePath, 'r')
    const buffer = Buffer.allocUnsafe(this.options.windowedReadChunkSize)
    let currentOffset = checkpoint.byteOffset
    let currentLineNumber = checkpoint.lineNumber

    try {
      while (currentOffset < index.totalBytes) {
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          buffer.length,
          currentOffset,
        )
        if (bytesRead === 0) {
          break
        }

        for (let position = 0; position < bytesRead; position += 1) {
          if (buffer[position] !== 10) {
            continue
          }

          currentLineNumber += 1
          if (currentLineNumber === targetLine) {
            return currentOffset + position + 1
          }
        }

        currentOffset += bytesRead
      }
    } finally {
      await fileHandle.close()
    }

    return index.totalBytes
  }

  private async readLargeFileWindowContent(
    index: MarkFlowLargeFileIndex,
    startOffset: number,
    windowStartLine: number,
    windowEndLine: number,
  ) {
    const fileHandle = await fs.promises.open(index.filePath, 'r')
    const buffer = Buffer.allocUnsafe(this.options.windowedReadChunkSize)
    const chunks: Buffer[] = []
    const desiredLineCount = windowEndLine - windowStartLine + 1

    let currentOffset = startOffset
    let collectedLineCount = 1

    try {
      while (currentOffset < index.totalBytes) {
        const { bytesRead } = await fileHandle.read(
          buffer,
          0,
          buffer.length,
          currentOffset,
        )
        if (bytesRead === 0) {
          break
        }

        const chunk = buffer.subarray(0, bytesRead)
        let segmentEnd = bytesRead
        for (let position = 0; position < bytesRead; position += 1) {
          if (chunk[position] !== 10) {
            continue
          }

          if (collectedLineCount === desiredLineCount) {
            segmentEnd = position
            chunks.push(Buffer.from(chunk.subarray(0, segmentEnd)))
            return Buffer.concat(chunks).toString('utf-8')
          }

          collectedLineCount += 1
        }

        if (segmentEnd > 0) {
          chunks.push(Buffer.from(chunk.subarray(0, segmentEnd)))
        }

        currentOffset += bytesRead
      }
    } finally {
      await fileHandle.close()
    }

    return Buffer.concat(chunks).toString('utf-8')
  }
}
