import { contextBridge, ipcRenderer } from 'electron'
import type {
  MarkFlowAppearance,
  MarkFlowDesktopAPI,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowMenuActionPayload,
  MarkFlowRecoveryCheckpoint,
  MarkFlowRecoveryDraft,
  MarkFlowSavePayload,
  MarkFlowSaveResult,
  SearchResult,
  MarkFlowThemeState,
} from '@markflow/shared'

function subscribe<T>(channel: string, cb: (data: T) => void) {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => cb(data)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: MarkFlowDesktopAPI = {
  openFile: () => ipcRenderer.invoke('open-file'),
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),
  saveFile: (content: string) => ipcRenderer.invoke('save-file', content) as Promise<MarkFlowSaveResult | null>,
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('save-file-as', content) as Promise<MarkFlowSaveResult | null>,
  scheduleRecoveryCheckpoint: (draft: MarkFlowRecoveryDraft) => {
    ipcRenderer.send('schedule-recovery-checkpoint', draft)
  },
  getRecoveryCheckpoint: () =>
    ipcRenderer.invoke('get-recovery-checkpoint') as Promise<MarkFlowRecoveryCheckpoint | null>,
  discardRecoveryCheckpoint: () => ipcRenderer.invoke('discard-recovery-checkpoint') as Promise<void>,
  exportHtml: (html: string, defaultPath: string) => ipcRenderer.invoke('export-html', html, defaultPath),
  exportPdf: (html: string, defaultPath: string) => ipcRenderer.invoke('export-pdf', html, defaultPath),
  exportDocx: (markdown: string, defaultPath: string) => ipcRenderer.invoke('export-docx', markdown, defaultPath),
  exportEpub: (markdown: string, defaultPath: string) => ipcRenderer.invoke('export-epub', markdown, defaultPath),
  exportLatex: (markdown: string, defaultPath: string) => ipcRenderer.invoke('export-latex', markdown, defaultPath),
  newFile: () => ipcRenderer.invoke('new-file'),
  getCurrentPath: () => ipcRenderer.invoke('get-current-path'),
  getQuickOpenList: () => ipcRenderer.invoke('get-quick-open-list'),
  getCurrentDocument: () => ipcRenderer.invoke('get-current-document'),
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getThemeState: () => ipcRenderer.invoke('get-theme-state'),
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),
  setTheme: (themeId: string) => ipcRenderer.invoke('set-theme', themeId),
  setThemeForAppearance: (appearance: MarkFlowAppearance, themeId: string) =>
    ipcRenderer.invoke('set-theme-for-appearance', appearance, themeId),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getVaultFiles: (folderPath: string) => ipcRenderer.invoke('get-vault-files', folderPath) as Promise<string[]>,
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  searchFiles: (folderPath: string, query: string) => ipcRenderer.invoke('search-files', folderPath, query) as Promise<SearchResult[]>,

  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => subscribe('file-opened', cb),
  onFileLoadingProgress: (cb: (data: MarkFlowFileLoadProgressPayload) => void) =>
    subscribe('file-loading-progress', cb),
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => subscribe('file-saved', cb),
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => subscribe('menu-action', cb),
  onThemeUpdated: (cb: (data: MarkFlowThemeState) => void) => subscribe('theme-updated', cb),
}

contextBridge.exposeInMainWorld('markflow', api)

export type MarkFlowAPI = typeof api
