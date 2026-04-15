import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { StringDecoder } from 'string_decoder'
const execFileAsync = promisify(execFile)
import * as path from 'path'
import type {
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowQuickOpenItem,
  MarkFlowRecoveryCheckpoint,
  MarkFlowRecoveryDraft,
  MarkFlowSaveResult,
  SearchResult,
} from '@markflow/shared'

const STREAM_OPEN_CHUNK_SIZE = 64 * 1024
const STREAM_OPEN_THRESHOLD_BYTES = 1024 * 1024
const STREAM_PREVIEW_BYTE_LIMIT = 64 * 1024
const RECOVERY_CHECKPOINT_DELAY_MS = 30_000
const RECOVERY_CHECKPOINT_FILE_NAME = '.markflow-recovery'
const SESSION_STATE_FILE_NAME = '.markflow-recovery-session.json'

interface MarkFlowSessionState {
  cleanExit: boolean
}

export class FileManager {
  private currentFilePath: string | null = null
  private recentFiles: string[] = []
  private pendingRecoveryDraft: MarkFlowRecoveryDraft | null = null
  private recoveryWriteTimer: NodeJS.Timeout | null = null
  private readonly recoveryCheckpointPath = path.join(app.getPath('temp'), RECOVERY_CHECKPOINT_FILE_NAME)
  private readonly sessionStatePath = path.join(app.getPath('userData'), SESSION_STATE_FILE_NAME)

  constructor(
    private window: BrowserWindow,
    private onCurrentFilePathChanged?: () => void,
  ) {}

  registerIpcHandlers() {
    ipcMain.removeHandler('open-file')
    ipcMain.removeHandler('open-path')
    ipcMain.removeHandler('save-file')
    ipcMain.removeHandler('save-file-as')
    ipcMain.removeHandler('new-file')
    ipcMain.removeHandler('get-current-path')
    ipcMain.removeHandler('get-current-document')
    ipcMain.removeHandler('get-recovery-checkpoint')
    ipcMain.removeHandler('discard-recovery-checkpoint')
    ipcMain.removeHandler('get-quick-open-list')
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
    ipcMain.handle('save-file', async (_event, content: string) => this.saveFile(content))
    ipcMain.handle('save-file-as', async (_event, content: string) => this.saveFileAs(content))
    ipcMain.handle('new-file', () => this.newFile())
    ipcMain.handle('get-current-path', () => this.currentFilePath)
    ipcMain.handle('get-current-document', () => this.getCurrentDocument())
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

  async saveFile(content?: string): Promise<MarkFlowSaveResult | null> {
    if (!this.currentFilePath) {
      return this.saveFileAs(content)
    }

    const saveResult = await this.writeFile(this.currentFilePath, content ?? '')
    if (saveResult.success) {
      await this.discardRecoveryCheckpoint()
      this.emitFileSaved(this.currentFilePath)
    }
    return saveResult
  }

  async saveFileAs(content?: string): Promise<MarkFlowSaveResult | null> {
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
      await this.discardRecoveryCheckpoint()
      this.emitFileSaved(result.filePath)
    }
    return saveResult
  }

  async openPath(filePath: string): Promise<MarkFlowFilePayload> {
    const content = await this.readFileForOpen(filePath)
    this.currentFilePath = filePath
    this.addToRecent(filePath)
    this.onCurrentFilePathChanged?.()
    this.window.webContents.send('file-opened', { filePath, content })
    this.updateTitle()
    return { filePath, content }
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

  getCurrentDocument(): MarkFlowFilePayload | null {
    if (!this.currentFilePath || !fs.existsSync(this.currentFilePath)) {
      return null
    }

    return {
      filePath: this.currentFilePath,
      content: fs.readFileSync(this.currentFilePath, 'utf-8'),
    }
  }

  scheduleRecoveryCheckpoint(draft: MarkFlowRecoveryDraft) {
    this.pendingRecoveryDraft = draft
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
      ) as Partial<MarkFlowRecoveryCheckpoint>

      if (
        typeof payload.content !== 'string' ||
        typeof payload.savedAt !== 'string' ||
        (payload.filePath !== null && typeof payload.filePath !== 'string')
      ) {
        return null
      }

      return {
        filePath: payload.filePath ?? null,
        content: payload.content,
        savedAt: payload.savedAt,
      }
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
      ...draft,
      savedAt: new Date().toISOString(),
    }

    try {
      await fs.promises.writeFile(this.recoveryCheckpointPath, JSON.stringify(checkpoint), 'utf-8')
    } catch (error) {
      console.error('Failed to write MarkFlow recovery checkpoint:', error)
    }
  }

  private async readFileForOpen(filePath: string): Promise<string> {
    const stats = await fs.promises.stat(filePath)
    if (stats.size < STREAM_OPEN_THRESHOLD_BYTES) {
      return fs.promises.readFile(filePath, 'utf-8')
    }

    return this.readLargeFileForOpen(filePath, stats.size)
  }

  private async readLargeFileForOpen(filePath: string, totalBytes: number): Promise<string> {
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

    return new Promise<string>((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        const bufferChunk = typeof chunk === 'string' ? Buffer.from(chunk) : chunk

        chunks.push(bufferChunk)
        bytesRead += bufferChunk.length

        if (previewContent.length < STREAM_PREVIEW_BYTE_LIMIT) {
          previewContent = `${previewContent}${previewDecoder.write(bufferChunk)}`.slice(0, STREAM_PREVIEW_BYTE_LIMIT)
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
        resolve(Buffer.concat(chunks).toString('utf-8'))
      })
    })
  }
}
