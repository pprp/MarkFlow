import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { MarkFlowFilePayload, MarkFlowSaveResult, MarkFlowQuickOpenItem } from '@markflow/shared'

export class FileManager {
  private currentFilePath: string | null = null
  private recentFiles: string[] = []

  constructor(private window: BrowserWindow) {}

  registerIpcHandlers() {
    ipcMain.removeHandler('open-file')
    ipcMain.removeHandler('open-path')
    ipcMain.removeHandler('save-file')
    ipcMain.removeHandler('save-file-as')
    ipcMain.removeHandler('new-file')
    ipcMain.removeHandler('get-current-path')
    ipcMain.removeHandler('get-current-document')
    ipcMain.removeHandler('get-quick-open-list')

    ipcMain.handle('open-file', () => this.openFile())
    ipcMain.handle('open-path', (_event, filePath: string) => this.openExistingPath(filePath))
    ipcMain.handle('save-file', async (_event, content: string) => this.saveFile(content))
    ipcMain.handle('save-file-as', async (_event, content: string) => this.saveFileAs(content))
    ipcMain.handle('new-file', () => this.newFile())
    ipcMain.handle('get-current-path', () => this.currentFilePath)
    ipcMain.handle('get-current-document', () => this.getCurrentDocument())
    ipcMain.handle('get-quick-open-list', () => this.getQuickOpenList())
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

  openExistingPath(filePath: string): MarkFlowFilePayload | null {
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
      this.emitFileSaved(result.filePath)
    }
    return saveResult
  }

  openPath(filePath: string): MarkFlowFilePayload {
    const content = fs.readFileSync(filePath, 'utf-8')
    this.currentFilePath = filePath
    this.addToRecent(filePath)
    this.window.webContents.send('file-opened', { filePath, content })
    this.updateTitle()
    return { filePath, content }
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
      } catch (err) {
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
}
