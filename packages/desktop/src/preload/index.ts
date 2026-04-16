import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type {
  MarkFlowAppearance,
  MarkFlowDesktopAPI,
  MarkFlowImageIngestRequest,
  MarkFlowImageIngestResult,
  MarkFlowImageUploadRequest,
  MarkFlowImageUploadResult,
  MarkFlowImageUploadSettings,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowMenuActionPayload,
  MarkFlowRecoveryCheckpoint,
  MarkFlowRecoveryDraft,
  MarkFlowSavePayload,
  MarkFlowSaveResult,
  MarkFlowSpellCheckState,
  SearchResult,
  MarkFlowWindowSession,
  MarkFlowWindowSessionState,
  MarkFlowThemeState,
  MarkFlowWindowState,
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
  openFolderPath: (folderPath: string) => ipcRenderer.invoke('open-folder-path', folderPath),
  readLargeFileWindow: (filePath: string, lineNumber: number) =>
    ipcRenderer.invoke('read-large-file-window', filePath, lineNumber),
  saveFile: (content: string, tabId?: string | null) =>
    ipcRenderer.invoke('save-file', content, tabId ?? null) as Promise<MarkFlowSaveResult | null>,
  saveFileAs: (content: string, tabId?: string | null) =>
    ipcRenderer.invoke('save-file-as', content, tabId ?? null) as Promise<MarkFlowSaveResult | null>,
  getFoldState: (filePath: string) => ipcRenderer.invoke('get-fold-state', filePath) as Promise<number[]>,
  saveFoldState: (filePath: string, ranges: number[]) =>
    ipcRenderer.invoke('save-fold-state', filePath, ranges) as Promise<void>,
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
  getWindowSession: () => ipcRenderer.invoke('get-window-session') as Promise<MarkFlowWindowSession | null>,
  getWindowState: () => ipcRenderer.invoke('get-window-state') as Promise<MarkFlowWindowState>,
  saveWindowSession: (session: MarkFlowWindowSessionState) =>
    ipcRenderer.invoke('save-window-session', session) as Promise<void>,
  confirmTabClose: (documentName: string) =>
    ipcRenderer.invoke('confirm-close-tab', documentName),
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getThemeState: () => ipcRenderer.invoke('get-theme-state'),
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),
  setTheme: (themeId: string) => ipcRenderer.invoke('set-theme', themeId),
  setThemeForAppearance: (appearance: MarkFlowAppearance, themeId: string) =>
    ipcRenderer.invoke('set-theme-for-appearance', appearance, themeId),
  getSpellCheckState: () =>
    ipcRenderer.invoke('get-spellcheck-state') as Promise<MarkFlowSpellCheckState>,
  setSpellCheckLanguage: (language: string | null) =>
    ipcRenderer.invoke('set-spellcheck-language', language) as Promise<MarkFlowSpellCheckState>,
  addSpellCheckWord: (word: string) =>
    ipcRenderer.invoke('add-spellcheck-word', word) as Promise<MarkFlowSpellCheckState>,
  removeSpellCheckWord: (word: string) =>
    ipcRenderer.invoke('remove-spellcheck-word', word) as Promise<MarkFlowSpellCheckState>,
  getImageUploadSettings: () =>
    ipcRenderer.invoke('get-image-upload-settings') as Promise<MarkFlowImageUploadSettings>,
  setImageUploadSettings: (settings: MarkFlowImageUploadSettings) =>
    ipcRenderer.invoke('set-image-upload-settings', settings) as Promise<MarkFlowImageUploadSettings>,
  ingestImage: (request: MarkFlowImageIngestRequest) =>
    ipcRenderer.invoke('ingest-image', request) as Promise<MarkFlowImageIngestResult>,
  uploadImage: (request: MarkFlowImageUploadRequest) =>
    ipcRenderer.invoke('upload-image', request) as Promise<MarkFlowImageUploadResult>,
  openFolder: () => ipcRenderer.invoke('open-folder'),
  getVaultFiles: (folderPath: string) => ipcRenderer.invoke('get-vault-files', folderPath) as Promise<string[]>,
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  searchFiles: (folderPath: string, query: string) => ipcRenderer.invoke('search-files', folderPath, query) as Promise<SearchResult[]>,
  writeClipboard: (payload) => {
    if (typeof payload.html === 'string' && payload.html.length > 0) {
      clipboard.write({
        html: payload.html,
        text: payload.text,
      })
      return
    }

    clipboard.writeText(payload.text)
  },

  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => subscribe('file-opened', cb),
  onFileLoadingProgress: (cb: (data: MarkFlowFileLoadProgressPayload) => void) =>
    subscribe('file-loading-progress', cb),
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => subscribe('file-saved', cb),
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => subscribe('menu-action', cb),
  onWindowStateChanged: (cb: (data: MarkFlowWindowState) => void) =>
    subscribe('window-state-changed', cb),
  onThemeUpdated: (cb: (data: MarkFlowThemeState) => void) => subscribe('theme-updated', cb),
}

contextBridge.exposeInMainWorld('markflow', api)

export type MarkFlowAPI = typeof api
