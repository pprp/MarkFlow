import { contextBridge, ipcRenderer } from 'electron'
import type {
  MarkFlowDesktopAPI,
  MarkFlowFilePayload,
  MarkFlowMenuActionPayload,
  MarkFlowSavePayload,
  MarkFlowSaveResult,
  MarkFlowThemePayload,
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
  newFile: () => ipcRenderer.invoke('new-file'),
  getCurrentPath: () => ipcRenderer.invoke('get-current-path'),
  getQuickOpenList: () => ipcRenderer.invoke('get-quick-open-list'),
  getCurrentDocument: () => ipcRenderer.invoke('get-current-document'),
  getThemes: () => ipcRenderer.invoke('get-themes'),
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),
  setTheme: (themeId: string) => ipcRenderer.invoke('set-theme', themeId),

  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => subscribe('file-opened', cb),
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => subscribe('file-saved', cb),
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => subscribe('menu-action', cb),
  onThemeUpdated: (cb: (data: MarkFlowThemePayload) => void) => subscribe('theme-updated', cb),
}

contextBridge.exposeInMainWorld('markflow', api)

export type MarkFlowAPI = typeof api
