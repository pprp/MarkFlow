export interface MarkFlowDocument {
  filePath: string | null
  content: string
  isDirty: boolean
}

export type ViewMode = 'source' | 'wysiwyg'

export interface MarkFlowFilePayload {
  filePath: string | null
  content: string
}

export interface MarkFlowSavePayload {
  filePath: string
}

export interface MarkFlowSaveResult {
  success: boolean
  error?: string
}

export type MarkFlowMenuAction = 'new-file' | 'open-file' | 'save-file' | 'save-file-as'

export interface MarkFlowMenuActionPayload {
  action: MarkFlowMenuAction
}

export interface MarkFlowDesktopAPI {
  openFile: () => Promise<MarkFlowFilePayload | null>
  saveFile: (content: string) => Promise<MarkFlowSaveResult | null>
  saveFileAs: (content: string) => Promise<MarkFlowSaveResult | null>
  newFile: () => Promise<void>
  getCurrentPath: () => Promise<string | null>
  getCurrentDocument: () => Promise<MarkFlowFilePayload | null>
  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => () => void
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => () => void
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => () => void
}
