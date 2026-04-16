export interface MarkFlowDocument {
  filePath: string | null
  content: string
  isDirty: boolean
}

export type ViewMode = 'source' | 'wysiwyg' | 'reading' | 'split'

export interface MarkFlowFilePayload {
  filePath: string | null
  content: string
  largeFile?: MarkFlowLargeFileWindow | null
}

export interface MarkFlowLargeFileWindow {
  totalBytes: number
  totalLines: number
  windowStartLine: number
  windowEndLine: number
  anchorLine: number
  readOnly: true
}

export interface MarkFlowFileLoadProgressPayload {
  filePath: string
  bytesRead: number
  totalBytes: number
  previewContent: string
  done: boolean
}

export interface MarkFlowSavePayload {
  filePath: string
}

export interface MarkFlowSaveResult {
  success: boolean
  error?: string
  filePath?: string | null
}

export interface MarkFlowRecoveryDraft {
  activeTabId: string | null
  documents: MarkFlowRecoveryDocument[]
}

export interface MarkFlowRecoveryDocument {
  tabId: string
  filePath: string | null
  content: string
}

export interface MarkFlowRecoveryCheckpoint extends MarkFlowRecoveryDraft {
  savedAt: string
}

export interface MarkFlowThemeSummary {
  id: string
  name: string
}

export interface MarkFlowThemePayload extends MarkFlowThemeSummary {
  cssText: string
}

export type MarkFlowAppearance = 'light' | 'dark'

export interface MarkFlowThemeState {
  activeAppearance: MarkFlowAppearance
  lightThemeId: string
  darkThemeId: string
  activeTheme: MarkFlowThemePayload | null
}

export interface MarkFlowSpellCheckState {
  selectedLanguage: string | null
  availableLanguages: string[]
  customWords: string[]
}

export type MarkFlowMenuAction =
  | 'new-file'
  | 'open-file'
  | 'save-file'
  | 'save-file-as'
  | 'close-tab'
  | 'reopen-closed-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'toggle-minimap'
  | 'clear-formatting'
  | 'copy'
  | 'copy-as-markdown'
  | 'copy-as-html-code'
  | 'export-html'
  | 'export-pdf'
  | 'export-docx'
  | 'export-epub'
  | 'export-latex'

export type MarkFlowTabCloseAction = 'save' | 'discard' | 'cancel'

export interface MarkFlowWindowSessionState {
  filePaths: string[]
  activeFilePath: string | null
}

export interface MarkFlowWindowSession {
  documents: MarkFlowFilePayload[]
  activeFilePath: string | null
}

export interface MarkFlowClipboardPayload {
  text: string
  html?: string
}

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

export type MarkFlowRenderedViewMode = 'wysiwyg' | 'reading' | 'split-preview'

export interface MarkFlowMarkdownPostProcessorContext {
  filePath?: string
  viewMode: MarkFlowRenderedViewMode
  root: HTMLElement
  sourceText: string
}

export type MarkFlowMarkdownPostProcessorCleanup = () => void

export interface MarkFlowMarkdownPostProcessor {
  selector?: string
  process: (
    element: HTMLElement,
    context: MarkFlowMarkdownPostProcessorContext,
  ) => void | MarkFlowMarkdownPostProcessorCleanup
}

export interface MarkFlowPluginContext {
  registerMarkdownPostProcessor: (
    processor: MarkFlowMarkdownPostProcessor,
  ) => () => void
}

export interface MarkFlowPlugin {
  id: string
  onload?: (context: MarkFlowPluginContext) => void | (() => void)
  onunload?: () => void
}

interface LoadedMarkFlowPlugin {
  cleanups: Array<() => void>
  plugin: MarkFlowPlugin
}

function runCleanups(cleanups: ReadonlyArray<() => void>) {
  for (const cleanup of [...cleanups].reverse()) {
    cleanup()
  }
}

function selectProcessorTargets(root: HTMLElement, selector?: string) {
  if (!selector) {
    return [root]
  }

  const targets: HTMLElement[] = []

  if (root.matches(selector)) {
    targets.push(root)
  }

  targets.push(...root.querySelectorAll<HTMLElement>(selector))
  return targets
}

export class MarkFlowPluginHost {
  private readonly plugins = new Map<string, LoadedMarkFlowPlugin>()
  private readonly markdownPostProcessors: MarkFlowMarkdownPostProcessor[] = []

  getMarkdownPostProcessorCount() {
    return this.markdownPostProcessors.length
  }

  load(plugin: MarkFlowPlugin) {
    this.unload(plugin.id)

    const cleanups: Array<() => void> = []
    const context: MarkFlowPluginContext = {
      registerMarkdownPostProcessor: (processor) => {
        this.markdownPostProcessors.push(processor)

        let isRegistered = true
        const unregister = () => {
          if (!isRegistered) {
            return
          }

          isRegistered = false
          const index = this.markdownPostProcessors.indexOf(processor)
          if (index >= 0) {
            this.markdownPostProcessors.splice(index, 1)
          }
        }

        cleanups.push(unregister)
        return unregister
      },
    }

    const maybeCleanup = plugin.onload?.(context)
    if (typeof maybeCleanup === 'function') {
      cleanups.push(maybeCleanup)
    }

    this.plugins.set(plugin.id, { cleanups, plugin })
  }

  setPlugins(plugins: readonly MarkFlowPlugin[]) {
    const nextIds = new Set(plugins.map((plugin) => plugin.id))

    for (const pluginId of this.plugins.keys()) {
      if (!nextIds.has(pluginId)) {
        this.unload(pluginId)
      }
    }

    for (const plugin of plugins) {
      const loaded = this.plugins.get(plugin.id)
      if (loaded?.plugin === plugin) {
        continue
      }

      this.load(plugin)
    }
  }

  unload(pluginId: string) {
    const loaded = this.plugins.get(pluginId)
    if (!loaded) {
      return
    }

    runCleanups(loaded.cleanups)
    loaded.plugin.onunload?.()
    this.plugins.delete(pluginId)
  }

  dispose() {
    for (const pluginId of [...this.plugins.keys()]) {
      this.unload(pluginId)
    }
  }

  runMarkdownPostProcessors(
    root: HTMLElement,
    context: Omit<MarkFlowMarkdownPostProcessorContext, 'root'>,
  ) {
    const cleanups: Array<() => void> = []
    const fullContext: MarkFlowMarkdownPostProcessorContext = {
      ...context,
      root,
    }

    for (const processor of this.markdownPostProcessors) {
      for (const element of selectProcessorTargets(root, processor.selector)) {
        const maybeCleanup = processor.process(element, fullContext)
        if (typeof maybeCleanup === 'function') {
          cleanups.push(maybeCleanup)
        }
      }
    }

    return () => runCleanups(cleanups)
  }
}

export interface MarkFlowDesktopAPI {
  openFile: () => Promise<MarkFlowFilePayload | null>
  openPath: (filePath: string) => Promise<MarkFlowFilePayload | null>
  readLargeFileWindow: (filePath: string, lineNumber: number) => Promise<MarkFlowFilePayload | null>
  saveFile: (content: string, tabId?: string | null) => Promise<MarkFlowSaveResult | null>
  saveFileAs: (content: string, tabId?: string | null) => Promise<MarkFlowSaveResult | null>
  getFoldState: (filePath: string) => Promise<number[]>
  saveFoldState: (filePath: string, ranges: number[]) => Promise<void>
  scheduleRecoveryCheckpoint: (draft: MarkFlowRecoveryDraft) => void
  getRecoveryCheckpoint: () => Promise<MarkFlowRecoveryCheckpoint | null>
  discardRecoveryCheckpoint: () => Promise<void>
  exportHtml: (html: string, defaultPath: string) => Promise<boolean>
  exportPdf: (html: string, defaultPath: string) => Promise<boolean>
  exportDocx: (markdown: string, defaultPath: string) => Promise<boolean>
  exportEpub: (markdown: string, defaultPath: string) => Promise<boolean>
  exportLatex: (markdown: string, defaultPath: string) => Promise<boolean>
  newFile: () => Promise<void>
  getCurrentPath: () => Promise<string | null>
  getQuickOpenList: () => Promise<MarkFlowQuickOpenItem[]>
  getCurrentDocument: () => Promise<MarkFlowFilePayload | null>
  getWindowSession: () => Promise<MarkFlowWindowSession | null>
  saveWindowSession: (session: MarkFlowWindowSessionState) => Promise<void>
  confirmTabClose: (documentName: string) => Promise<MarkFlowTabCloseAction>
  getThemes: () => Promise<MarkFlowThemeSummary[]>
  getThemeState: () => Promise<MarkFlowThemeState | null>
  getCurrentTheme: () => Promise<MarkFlowThemePayload | null>
  setTheme: (themeId: string) => Promise<MarkFlowThemePayload | null>
  setThemeForAppearance: (
    appearance: MarkFlowAppearance,
    themeId: string,
  ) => Promise<MarkFlowThemeState | null>
  getSpellCheckState: () => Promise<MarkFlowSpellCheckState>
  setSpellCheckLanguage: (language: string | null) => Promise<MarkFlowSpellCheckState>
  addSpellCheckWord: (word: string) => Promise<MarkFlowSpellCheckState>
  removeSpellCheckWord: (word: string) => Promise<MarkFlowSpellCheckState>
  openFolder: () => Promise<{ folderPath: string } | null>
  getVaultFiles: (folderPath: string) => Promise<string[]>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  deleteFile: (filePath: string) => Promise<void>
  searchFiles: (folderPath: string, query: string) => Promise<SearchResult[]>
  writeClipboard: (payload: MarkFlowClipboardPayload) => Promise<void> | void
  onFileOpened: (cb: (data: MarkFlowFilePayload) => void) => () => void
  onFileLoadingProgress: (cb: (data: MarkFlowFileLoadProgressPayload) => void) => () => void
  onFileSaved: (cb: (data: MarkFlowSavePayload) => void) => () => void
  onMenuAction: (cb: (data: MarkFlowMenuActionPayload) => void) => () => void
  onThemeUpdated: (cb: (data: MarkFlowThemeState) => void) => () => void
}
