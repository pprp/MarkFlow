export interface MarkFlowDocument {
  filePath: string | null
  content: string
  isDirty: boolean
}

export type ViewMode = 'source' | 'wysiwyg' | 'reading' | 'split'

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

export interface SearchResult {
  filePath: string
  lineNumber: number
  lineText: string
  matchStart: number
  matchEnd: number
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
  openFolder: () => Promise<{ folderPath: string } | null>
  getVaultFiles: (folderPath: string) => Promise<string[]>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<void>
  searchFiles: (folderPath: string, query: string) => Promise<SearchResult[]>
  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => () => void
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => () => void
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => () => void
  onThemeUpdated: (cb: (data: MarkFlowThemePayload) => void) => () => void
}
