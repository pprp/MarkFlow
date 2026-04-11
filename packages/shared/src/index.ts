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

export interface MarkFlowThemeSummary {
  id: string
  name: string
}

export interface MarkFlowThemePayload extends MarkFlowThemeSummary {
  cssText: string
}

export type MarkFlowMenuAction = 'new-file' | 'open-file' | 'save-file' | 'save-file-as'

export interface MarkFlowMenuActionPayload {
  action: MarkFlowMenuAction
}

export interface MarkFlowQuickOpenItem {
  id: string
  label: string
  description?: string
  filePath: string
  isRecent: boolean
}

export interface MarkFlowDesktopAPI {
  openFile: () => Promise<MarkFlowFilePayload | null>
  openPath: (filePath: string) => Promise<MarkFlowFilePayload | null>
  saveFile: (content: string) => Promise<MarkFlowSaveResult | null>
  saveFileAs: (content: string) => Promise<MarkFlowSaveResult | null>
  newFile: () => Promise<void>
  getCurrentPath: () => Promise<string | null>
  getQuickOpenList: () => Promise<MarkFlowQuickOpenItem[]>
  getCurrentDocument: () => Promise<MarkFlowFilePayload | null>
  getThemes: () => Promise<MarkFlowThemeSummary[]>
  getCurrentTheme: () => Promise<MarkFlowThemePayload | null>
  setTheme: (themeId: string) => Promise<MarkFlowThemePayload | null>
  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => () => void
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => () => void
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => () => void
  onThemeUpdated: (cb: (data: MarkFlowThemePayload) => void) => () => void
}
