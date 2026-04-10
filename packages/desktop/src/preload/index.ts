import { contextBridge, ipcRenderer } from 'electron'
import type {
  MarkFlowDesktopAPI,
  MarkFlowFilePayload,
  MarkFlowMenuActionPayload,
  MarkFlowSavePayload,
  MarkFlowSaveResult,
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
  saveFile: (content: string) => ipcRenderer.invoke('save-file', content) as Promise<MarkFlowSaveResult | null>,
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('save-file-as', content) as Promise<MarkFlowSaveResult | null>,
  newFile: () => ipcRenderer.invoke('new-file'),
  getCurrentPath: () => ipcRenderer.invoke('get-current-path'),
  getCurrentDocument: () => ipcRenderer.invoke('get-current-document'),

  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => subscribe('file-opened', cb),
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => subscribe('file-saved', cb),
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => subscribe('menu-action', cb),
}

contextBridge.exposeInMainWorld('markflow', api)

export type MarkFlowAPI = typeof api
