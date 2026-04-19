import {
  startTransition,
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppStatusBar } from './app-shell/AppStatusBar'
import {
  INITIAL_CONTENT,
  buildWindowSessionState,
  createDocumentTab,
  findTabIndex,
  getLineNumberAtPosition,
  getTabLabel,
  type ClosedDocumentTabState,
  type DocumentTabState,
  type MarkFlowStartupAPI,
} from './app-shell/documents'
import { useCommandPaletteActions } from './app-shell/useCommandPaletteActions'
import { useDesktopBridge } from './app-shell/useDesktopBridge'
import { useNavigationHistoryController } from './app-shell/useNavigationHistoryController'
import { useSearchDialogs } from './app-shell/useSearchDialogs'
import { useStatusBarPanels } from './app-shell/useStatusBarPanels'
import {
  MarkFlowEditor,
  type MarkFlowEditorHandle,
  type MarkFlowEditorSnapshot,
} from './editor/MarkFlowEditor'
import { type SymbolTable } from './editor/indexer'
import { findActiveHeadingAnchor } from './editor/outline'
import { CommandPalette } from './components/CommandPalette'
import { QuickOpen } from './components/QuickOpen'
import { VaultSidebar } from './components/VaultSidebar'
import { GlobalSearch } from './components/GlobalSearch'
import { GoToLine } from './components/GoToLine'
import { DocumentSearch } from './components/DocumentSearch'
import { Minimap, type MinimapScrollMetrics } from './components/Minimap'
import type { RegisteredCommandPaletteAction } from './components/commandPaletteRegistry'
import { serializeMarkdownSelectionForClipboard } from './editor/clipboard'
import { areCollapsedRangesEqual } from './editor/foldingState'
import { createExternalLinkBadgePlugin } from './plugins/externalLinkBadgePlugin'
import {
  MarkFlowPluginHost,
  type MarkFlowDesktopAPI,
  type MarkFlowQuickOpenItem,
  type MarkFlowFileLoadProgressPayload,
  type MarkFlowImageUploadSettings,
  type MarkFlowRecoveryDraft,
  type MarkFlowSpellCheckState,
  type MarkFlowTabCloseAction,
  type MarkFlowThemeState,
  type ViewMode,
  type MarkFlowWindowState,
} from '@markflow/shared'
import {
  loadLocalSpellCheckState,
  normalizeSpellCheckState,
  persistLocalSpellCheckState,
  sanitizeSpellCheckWord,
} from './spellCheckProfile'
import {
  HEADING_NUMBERING_ATTRIBUTE,
  HEADING_NUMBERING_CSS,
  HEADING_NUMBERING_OUTLINE_LEVEL_ATTRIBUTE,
  HEADING_NUMBERING_STYLE_ELEMENT_ID,
  loadLocalHeadingNumberingPreference,
  persistLocalHeadingNumberingPreference,
} from './headingNumbering'
import {
  loadLocalSourceLineNumbersPreference,
  persistLocalSourceLineNumbersPreference,
} from './sourceLineNumbers'
import {
  type MarkFlowStatisticsPreferences,
  loadLocalStatisticsPreferences,
  persistLocalStatisticsPreferences,
} from './statisticsPreferences'
import {
  loadLocalMarkdownModePreference,
  persistLocalMarkdownModePreference,
  type MarkFlowMarkdownMode,
} from './markdownMode'
import { countFuzzySearchMatches } from './editor/documentSearch'
import { serializeRenderedDocumentForExport } from './export/htmlExport'

const THEME_STYLE_ELEMENT_ID = 'mf-theme-overrides'
const EDITOR_ROOT_SELECTOR = '.cm-editor'
export const RECOVERY_CHECKPOINT_SYNC_DELAY_MS = 750

type DocumentSearchWorkerRequest = {
  requestId: number
  content: string
  query: string
}

type DocumentSearchWorkerResponse = {
  requestId: number
  count: number
}

function formatLoadingBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

type AppToast = {
  id: number
  message: string
}

type EditorImageInsertDetail = {
  file: File & { path?: string }
  markdownText: string
  occurrenceIndex: number
}

type ActiveOutlineAnchorSource = 'cursor' | 'viewport'

function rewriteImageMarkdownSource(markdownText: string, nextSource: string) {
  const match = markdownText.match(/^(!\[[^\]]*\]\()([^)]*)(\).*)$/)
  if (!match) {
    return markdownText
  }

  return `${match[1]}${nextSource}${match[3]}`
}

function replaceNthOccurrence(
  text: string,
  searchText: string,
  replacementText: string,
  occurrenceIndex: number,
) {
  if (!searchText) {
    return null
  }

  let fromIndex = 0
  let currentOccurrence = 0
  while (fromIndex <= text.length) {
    const foundAt = text.indexOf(searchText, fromIndex)
    if (foundAt < 0) {
      return null
    }

    if (currentOccurrence === occurrenceIndex) {
      return (
        text.slice(0, foundAt) +
        replacementText +
        text.slice(foundAt + searchText.length)
      )
    }

    currentOccurrence += 1
    fromIndex = foundAt + searchText.length
  }

  return null
}

function isEditorCopyContext() {
  const activeElement = document.activeElement

  if (activeElement instanceof Element) {
    if (activeElement.closest(EDITOR_ROOT_SELECTOR)) {
      return true
    }

    if (activeElement !== document.body) {
      return false
    }
  }

  const selectionAnchor = document.getSelection()?.anchorNode
  if (!selectionAnchor) {
    return false
  }

  const selectionElement =
    selectionAnchor instanceof Element ? selectionAnchor : selectionAnchor.parentElement

  return selectionElement?.closest(EDITOR_ROOT_SELECTOR) != null
}

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('wysiwyg')
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [markdownMode, setMarkdownMode] = useState<MarkFlowMarkdownMode>(() =>
    loadLocalMarkdownModePreference(),
  )
  const [headingNumberingEnabled, setHeadingNumberingEnabled] = useState(() =>
    loadLocalHeadingNumberingPreference(),
  )
  const [sourceLineNumbersEnabled, setSourceLineNumbersEnabled] = useState(() =>
    loadLocalSourceLineNumbersPreference(),
  )
  const [statisticsPreferences, setStatisticsPreferences] = useState<MarkFlowStatisticsPreferences>(() =>
    loadLocalStatisticsPreferences(),
  )
  const [isDistractionFreeMode, setIsDistractionFreeMode] = useState(false)
  const [windowState, setWindowState] = useState<MarkFlowWindowState>({
    isAlwaysOnTop: false,
    isFullscreen: false,
  })
  const [showSidebar, setShowSidebar] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [vaultFiles, setVaultFiles] = useState<string[]>([])
  const [spellCheckState, setSpellCheckState] = useState<MarkFlowSpellCheckState>(() =>
    loadLocalSpellCheckState(),
  )
  const [spellCheckWordInput, setSpellCheckWordInput] = useState('')
  const [imageUploadSettings, setImageUploadSettings] = useState<MarkFlowImageUploadSettings | null>(null)
  const statusBarPanels = useStatusBarPanels()
  const {
    closeStatusbarPanels,
    isDocumentStatisticsOpen,
    toggleDocumentStatistics,
  } = statusBarPanels
  const {
    closeCommandPalette,
    closeDocumentSearch,
    closeGlobalSearch,
    closeGoToLine,
    closeQuickOpen,
    isCommandPaletteOpen,
    isDocumentSearchOpen,
    isGlobalSearchOpen,
    isGoToLineOpen,
    isQuickOpenOpen,
    openCommandPalette,
    openDocumentSearch,
    openGlobalSearch,
    openGoToLine,
    openQuickOpen,
    toggleGlobalSearch,
  } = useSearchDialogs()
  const [toasts, setToasts] = useState<AppToast[]>([])
  const [documentSearchQuery, setDocumentSearchQuery] = useState('')
  const [documentSearchMatchCount, setDocumentSearchMatchCount] = useState(0)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [quickOpenItems, setQuickOpenItems] = useState<MarkFlowQuickOpenItem[]>([])
  const [tabs, setTabs] = useState<DocumentTabState[]>(() => [createDocumentTab(null, INITIAL_CONTENT)])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [closedTabs, setClosedTabs] = useState<ClosedDocumentTabState[]>([])
  const [loadingFile, setLoadingFile] = useState<MarkFlowFileLoadProgressPayload | null>(null)
  const [editorScrollMetrics, setEditorScrollMetrics] = useState<MinimapScrollMetrics | null>(null)
  const [activeCursorLineNumber, setActiveCursorLineNumber] = useState(1)
  const [activeOutlineAnchorSource, setActiveOutlineAnchorSource] =
    useState<ActiveOutlineAnchorSource>('cursor')
  const tabsRef = useRef<DocumentTabState[]>(tabs)
  const activeTabIdRef = useRef<string | null>(null)
  const handleSaveTabRef = useRef<(tabId: string | null, forceSaveAs?: boolean) => Promise<boolean>>(
    async () => false,
  )
  const handleCloseTabRef = useRef<(tabId: string | null) => Promise<boolean>>(async () => false)
  const handleReopenClosedTabRef = useRef<() => Promise<boolean>>(async () => false)
  const handleNavigateBackRef = useRef<() => Promise<boolean>>(async () => false)
  const handleNavigateForwardRef = useRef<() => Promise<boolean>>(async () => false)
  const handleCycleTabsRef = useRef<(direction: 1 | -1) => void>(() => {})
  const handleOpenFolderPathRef = useRef<(folderPath: string) => Promise<boolean>>(async () => false)
  const handleOpenQuickOpenRef = useRef<() => Promise<boolean>>(async () => false)
  const handleCopyActionRef = useRef<
    (action: 'copy' | 'copy-as-markdown' | 'copy-as-html-code') => Promise<void>
  >(async () => {})
  const handleExportRef = useRef<(format: 'html' | 'pdf') => Promise<void>>(async () => {})
  const handlePandocExportRef = useRef<
    (action: 'export-docx' | 'export-epub' | 'export-latex') => Promise<void>
  >(async () => {})
  const pluginHostRef = useRef<MarkFlowPluginHost | null>(null)
  const editorRef = useRef<MarkFlowEditorHandle | null>(null)
  const editorShellRef = useRef<HTMLDivElement | null>(null)
  const documentSearchWorkerRef = useRef<Worker | null>(null)
  const documentSearchRequestIdRef = useRef(0)
  const recoveryCheckpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastIdRef = useRef(0)

  if (pluginHostRef.current === null) {
    pluginHostRef.current = new MarkFlowPluginHost()
    pluginHostRef.current.setPlugins([createExternalLinkBadgePlugin()])
  }

  const applySpellCheckState = useCallback((nextState: MarkFlowSpellCheckState) => {
    const normalizedState = normalizeSpellCheckState(nextState)
    setSpellCheckState(normalizedState)
    return normalizedState
  }, [])

  const updateLocalSpellCheckState = useCallback(
    (updater: (currentState: MarkFlowSpellCheckState) => MarkFlowSpellCheckState) => {
      setSpellCheckState((currentState) => {
        const nextState = normalizeSpellCheckState(updater(currentState))
        persistLocalSpellCheckState(nextState)
        return nextState
      })
    },
    [],
  )

  const updateStatisticsPreferences = useCallback((nextPreferences: MarkFlowStatisticsPreferences) => {
    setStatisticsPreferences(nextPreferences)
    persistLocalStatisticsPreferences(nextPreferences)
  }, [])

  const updateMarkdownModePreference = useCallback((mode: MarkFlowMarkdownMode) => {
    setMarkdownMode(mode)
    persistLocalMarkdownModePreference(mode)
  }, [])

  const activeTab = useMemo(() => {
    const byId = tabs.find((tab) => tab.id === activeTabId)
    return byId ?? tabs[0] ?? null
  }, [activeTabId, tabs])

  const replaceTabs = useCallback((nextTabs: DocumentTabState[]) => {
    if (tabsRef.current === nextTabs) {
      return nextTabs
    }
    tabsRef.current = nextTabs
    setTabs(nextTabs)
    return nextTabs
  }, [])

  const updateTabs = useCallback((updater: (currentTabs: DocumentTabState[]) => DocumentTabState[]) => {
    const currentTabs = tabsRef.current
    const nextTabs = updater(currentTabs)
    if (nextTabs === currentTabs) {
      return currentTabs
    }
    tabsRef.current = nextTabs
    setTabs(nextTabs)
    return nextTabs
  }, [])

  const replaceActiveTabId = useCallback((nextActiveTabId: string | null) => {
    activeTabIdRef.current = nextActiveTabId
    setActiveTabId(nextActiveTabId)
  }, [])

  useEffect(() => {
    if (activeTabId == null && tabs[0]) {
      replaceActiveTabId(tabs[0].id)
      return
    }

    if (activeTabId && !tabs.some((tab) => tab.id === activeTabId)) {
      replaceActiveTabId(tabs[0]?.id ?? null)
    }
  }, [activeTabId, replaceActiveTabId, tabs])

  useEffect(() => {
    activeTabIdRef.current = activeTab?.id ?? null
  }, [activeTab])

  useEffect(() => {
    if (!activeTab) {
      setActiveCursorLineNumber(1)
      return
    }

    startTransition(() => {
      setActiveCursorLineNumber(getLineNumberAtPosition(activeTab.content, activeTab.cursorPosition))
    })
  }, [activeTab?.filePath, activeTab?.id])

  const updateTab = useCallback((tabId: string, updater: (tab: DocumentTabState) => DocumentTabState) => {
    updateTabs((currentTabs) => {
      let changed = false
      const nextTabs = currentTabs.map((tab) => {
        if (tab.id !== tabId) {
          return tab
        }

        const nextTab = updater(tab)
        if (nextTab !== tab) {
          changed = true
        }
        return nextTab
      })

      return changed ? nextTabs : currentTabs
    })
  }, [updateTabs])

  const syncWindowSession = useCallback(async (nextTabs: readonly DocumentTabState[], nextActiveTabId: string | null) => {
    const api = window.markflow as MarkFlowStartupAPI | undefined
    if (!api) {
      return
    }

    await api.saveWindowSession(buildWindowSessionState(nextTabs, nextActiveTabId))
  }, [])

  const loadCollapsedRangesForTab = useCallback(
    async (api: MarkFlowDesktopAPI, tabId: string, filePath: string | null) => {
      if (!filePath) {
        updateTab(tabId, (tab) => (tab.collapsedRanges.length === 0 ? tab : { ...tab, collapsedRanges: [] }))
        return
      }

      const nextRanges = await api.getFoldState(filePath)
      updateTab(tabId, (tab) => {
        if (tab.filePath !== filePath || areCollapsedRangesEqual(tab.collapsedRanges, nextRanges)) {
          return tab
        }

        return {
          ...tab,
          collapsedRanges: [...nextRanges],
        }
      })
    },
    [updateTab],
  )

  const clearRecoveryCheckpointTimer = useCallback(() => {
    if (recoveryCheckpointTimerRef.current !== null) {
      clearTimeout(recoveryCheckpointTimerRef.current)
      recoveryCheckpointTimerRef.current = null
    }
  }, [])

  const getCurrentTabContent = useCallback(
    (tab: DocumentTabState) => {
      if (tab.id !== activeTabIdRef.current || tab.largeFile) {
        return tab.content
      }

      return editorRef.current?.getContent() ?? tab.content
    },
    [],
  )

  const buildRecoveryCheckpointDraft = useCallback((): MarkFlowRecoveryDraft | null => {
    const currentTabs = tabsRef.current
    const documents = currentTabs.flatMap((tab) => {
      if (tab.largeFile || !tab.isDirty) {
        return []
      }

      return [
        {
          tabId: tab.recoveryTabId ?? tab.id,
          filePath: tab.filePath,
          content: getCurrentTabContent(tab),
        },
      ]
    })

    if (documents.length === 0) {
      return null
    }

    const currentActiveTab = currentTabs.find((tab) => tab.id === activeTabIdRef.current) ?? null
    return {
      activeTabId:
        currentActiveTab?.isDirty && currentActiveTab.largeFile == null
          ? currentActiveTab.recoveryTabId ?? currentActiveTab.id
          : null,
      documents,
    }
  }, [getCurrentTabContent])

  const scheduleRecoveryCheckpoint = useCallback(() => {
    const api = window.markflow
    clearRecoveryCheckpointTimer()
    if (!api) {
      return
    }

    if (!tabsRef.current.some((tab) => tab.isDirty && tab.largeFile == null)) {
      return
    }

    recoveryCheckpointTimerRef.current = setTimeout(() => {
      recoveryCheckpointTimerRef.current = null
      const draft = buildRecoveryCheckpointDraft()
      if (draft) {
        api.scheduleRecoveryCheckpoint(draft)
      }
    }, RECOVERY_CHECKPOINT_SYNC_DELAY_MS)
  }, [buildRecoveryCheckpointDraft, clearRecoveryCheckpointTimer])

  const captureActiveTabSnapshot = useCallback(() => {
    const currentActiveTabId = activeTabIdRef.current
    const snapshot = editorRef.current?.captureSnapshot()
    if (!currentActiveTabId || !snapshot) {
      return null
    }

    updateTab(currentActiveTabId, (tab) => {
      if (tab.largeFile) {
        return {
          ...tab,
          snapshot,
          collapsedRanges: areCollapsedRangesEqual(tab.collapsedRanges, snapshot.collapsedRanges)
            ? tab.collapsedRanges
            : [...snapshot.collapsedRanges],
        }
      }

      const content = getCurrentTabContent(tab)
      const isDirty = content !== tab.persistedContent
      return {
        ...tab,
        content,
        isDirty,
        snapshot,
        collapsedRanges: areCollapsedRangesEqual(tab.collapsedRanges, snapshot.collapsedRanges)
          ? tab.collapsedRanges
          : [...snapshot.collapsedRanges],
      }
    })
    return snapshot
  }, [getCurrentTabContent, updateTab])

  useEffect(() => () => {
    pluginHostRef.current?.dispose()
  }, [])

  useEffect(() => {
    const api = window.markflow
    if (!api) {
      return
    }

    void api.getSpellCheckState().then((nextState) => {
      applySpellCheckState(nextState)
    })
  }, [applySpellCheckState])

  useEffect(() => {
    const api = window.markflow
    if (!api) {
      return
    }

    void api.getImageUploadSettings().then((nextSettings) => {
      setImageUploadSettings(nextSettings)
    })
  }, [])

  const isImmersiveMode = windowState.isFullscreen || isDistractionFreeMode

  const applyThemeState = useCallback((nextThemeState: MarkFlowThemeState | null) => {
    const existing = document.getElementById(THEME_STYLE_ELEMENT_ID) as HTMLStyleElement | null
    const style = existing ?? document.createElement('style')

    if (!existing) {
      style.id = THEME_STYLE_ELEMENT_ID
      document.head.appendChild(style)
    }

    style.textContent = nextThemeState?.activeTheme?.cssText ?? ''
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode((m) => (m === 'wysiwyg' ? 'source' : 'wysiwyg'))
  }, [])

  const toggleFocusMode = useCallback(() => {
    setFocusMode((v) => !v)
  }, [])

  const toggleTypewriterMode = useCallback(() => {
    setTypewriterMode((v) => !v)
  }, [])

  const toggleDistractionFreeMode = useCallback(() => {
    setIsDistractionFreeMode((v) => !v)
  }, [])

  const refreshQuickOpenItems = useCallback(async () => {
    const api = window.markflow
    if (!api) {
      setQuickOpenItems([])
      return []
    }

    const items = await api.getQuickOpenList()
    setQuickOpenItems(items)
    return items
  }, [])

  useEffect(() => {
    if (!isImmersiveMode) {
      return
    }

    closeStatusbarPanels()
  }, [closeStatusbarPanels, isImmersiveMode])

  useEffect(() => {
    setEditorScrollMetrics(null)
  }, [activeTab?.id])

  useEffect(() => {
    if (!showSidebar) {
      return
    }

    void refreshQuickOpenItems()
  }, [activeTab?.filePath, refreshQuickOpenItems, showSidebar])

  const handleOpenCommandPalette = useCallback(() => {
    openCommandPalette()
  }, [openCommandPalette])

  const showToast = useCallback((message: string) => {
    toastIdRef.current += 1
    const nextToast = {
      id: toastIdRef.current,
      message,
    }
    setToasts((currentToasts) => [...currentToasts, nextToast])
    window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== nextToast.id))
    }, 4_000)
  }, [])

  const {
    clearEditorNavigationRequest,
    editorNavigationRequest,
    handleGlobalSearchResult,
    handleGoToLine,
    handleMinimapNavigate,
    handleNavigateBack,
    handleNavigateForward,
    handleOpenPath,
    handleOutlineNavigate,
  } = useNavigationHistoryController({
    activeTab,
    activeTabIdRef,
    captureActiveTabSnapshot,
    closeGlobalSearch,
    closeGoToLine,
    replaceActiveTabId,
    showToast,
    tabsRef,
    updateTab,
  })

  useDesktopBridge({
    activeTabIdRef,
    applyThemeState,
    captureActiveTabSnapshot,
    clearEditorNavigationRequest,
    closeGoToLine,
    editorRef,
    handleCloseTabRef,
    handleCopyActionRef,
    handleCycleTabsRef,
    handleExportRef,
    handleNavigateBackRef,
    handleNavigateForwardRef,
    handleOpenFolderPathRef,
    handleOpenQuickOpenRef,
    handlePandocExportRef,
    handleReopenClosedTabRef,
    handleSaveTabRef,
    loadCollapsedRangesForTab,
    openCommandPalette,
    openGlobalSearch,
    openGoToLine,
    replaceActiveTabId,
    replaceTabs,
    setLoadingFile,
    setOutlineCollapsed,
    setShowMinimap,
    setShowSidebar,
    setVaultFiles,
    setVaultPath,
    setWindowState,
    tabsRef,
    toggleDistractionFreeMode,
    toggleDocumentStatistics,
    toggleFocusMode,
    toggleTypewriterMode,
    updateTabs,
  })

  const handleOpenQuickOpen = useCallback(async () => {
    const api = window.markflow
    if (!api) {
      return false
    }

    await refreshQuickOpenItems()
    openQuickOpen()
    return true
  }, [openQuickOpen, refreshQuickOpenItems])

  const handleOpenFolderPath = useCallback(
    async (folderPath: string) => {
      const api = window.markflow
      if (!api) {
        return false
      }

      const result = await api.openFolderPath(folderPath)
      if (!result) {
        showToast('That recent folder is no longer available.')
        return false
      }

      setVaultPath(result.folderPath)
      setShowSidebar(true)
      const files = await api.getVaultFiles(result.folderPath)
      setVaultFiles(files ?? [])
      await refreshQuickOpenItems()
      return true
    },
    [refreshQuickOpenItems, showToast],
  )

  const handleOpenGlobalSearch = useCallback(() => {
    return openGlobalSearch()
  }, [openGlobalSearch])

  const handleToggleGlobalSearch = useCallback(() => {
    return toggleGlobalSearch()
  }, [toggleGlobalSearch])

  const handleOpenGoToLine = useCallback(() => {
    return openGoToLine()
  }, [openGoToLine])

  const handleOpenDocumentSearch = useCallback(() => {
    if (!activeTab || activeTab.largeFile) {
      return false
    }

    openDocumentSearch()
    return true
  }, [activeTab, openDocumentSearch])

  const handleCloseDocumentSearch = useCallback(() => {
    closeDocumentSearch()
    setDocumentSearchQuery('')
    setDocumentSearchMatchCount(0)
    editorRef.current?.clearDocumentSearch()
    editorRef.current?.focus()
  }, [closeDocumentSearch])

  const handleNextDocumentSearchMatch = useCallback(() => {
    if (!documentSearchQuery.trim()) {
      return
    }

    editorRef.current?.navigateDocumentSearch('next')
  }, [documentSearchQuery])

  const handlePreviousDocumentSearchMatch = useCallback(() => {
    if (!documentSearchQuery.trim()) {
      return
    }

    editorRef.current?.navigateDocumentSearch('previous')
  }, [documentSearchQuery])

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      return
    }

    const worker = new Worker(new URL('./editor/documentSearch.worker.ts', import.meta.url), {
      type: 'module',
    })
    documentSearchWorkerRef.current = worker

    return () => {
      worker.terminate()
      documentSearchWorkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    if (!isDocumentSearchOpen || !documentSearchQuery.trim()) {
      editor.clearDocumentSearch()
      return
    }

    editor.setDocumentSearchQuery(documentSearchQuery)
  }, [activeTab?.content, activeTab?.id, documentSearchQuery, isDocumentSearchOpen])

  useEffect(() => {
    if (isDocumentSearchOpen) {
      return
    }

    setDocumentSearchMatchCount(0)
    editorRef.current?.clearDocumentSearch()
  }, [isDocumentSearchOpen])

  useEffect(() => {
    if (!isDocumentSearchOpen || !activeTab || activeTab.largeFile || !documentSearchQuery.trim()) {
      setDocumentSearchMatchCount(0)
      return
    }

    const requestId = documentSearchRequestIdRef.current + 1
    documentSearchRequestIdRef.current = requestId
    const content = activeTab.content
    const worker = documentSearchWorkerRef.current

    if (!worker) {
      const timeoutId = window.setTimeout(() => {
        if (documentSearchRequestIdRef.current !== requestId) {
          return
        }

        startTransition(() => {
          setDocumentSearchMatchCount(countFuzzySearchMatches(content, documentSearchQuery))
        })
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    const handleMessage = (event: MessageEvent<DocumentSearchWorkerResponse>) => {
      if (event.data.requestId !== requestId) {
        return
      }

      startTransition(() => {
        setDocumentSearchMatchCount(event.data.count)
      })
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({
      requestId,
      content,
      query: documentSearchQuery,
    } satisfies DocumentSearchWorkerRequest)

    return () => {
      worker.removeEventListener('message', handleMessage)
    }
  }, [activeTab, documentSearchQuery, isDocumentSearchOpen])

  async function handleOpenFolder() {
    const api = window.markflow
    if (!api) {
      return
    }

    const result = await api.openFolder()
    if (!result) {
      return
    }

    setVaultPath(result.folderPath)
    setShowSidebar(true)
    const files = await api.getVaultFiles(result.folderPath)
    setVaultFiles(files ?? [])
    await refreshQuickOpenItems()
  }

  async function handleVaultFileRename(oldPath: string, newName: string) {
    if (!vaultPath) return
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
    const newPath = dir + newName
    await window.markflow?.renameFile(oldPath, newPath)
    const files = await window.markflow?.getVaultFiles(vaultPath)
    setVaultFiles(files ?? [])
  }

  async function handleVaultFileDelete(filePath: string) {
    await window.markflow?.deleteFile(filePath)
    if (vaultPath) {
      const files = await window.markflow?.getVaultFiles(vaultPath)
      setVaultFiles(files ?? [])
    }
  }

  const handleSwitchTab = useCallback(
    (tabId: string | null) => {
      if (!tabId || tabId === activeTabIdRef.current) {
        return
      }

      captureActiveTabSnapshot()
      clearEditorNavigationRequest()
      closeGoToLine()
      replaceActiveTabId(tabId)
    },
    [captureActiveTabSnapshot, clearEditorNavigationRequest, closeGoToLine, replaceActiveTabId],
  )

  const handleCycleTabs = useCallback(
    (direction: 1 | -1) => {
      const currentTabs = tabsRef.current
      if (currentTabs.length <= 1) {
        return
      }

      const currentIndex = findTabIndex(currentTabs, activeTabIdRef.current)
      const startIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex = (startIndex + direction + currentTabs.length) % currentTabs.length
      handleSwitchTab(currentTabs[nextIndex]?.id ?? null)
    },
    [handleSwitchTab],
  )

  const handleSaveTab = useCallback(
    async (tabId: string | null, forceSaveAs: boolean = false) => {
      const api = window.markflow
      if (!api || !tabId) {
        return false
      }

      const tab = tabsRef.current.find((currentTab) => currentTab.id === tabId)
      if (!tab) {
        return false
      }
      if (tab.largeFile) {
        return false
      }

      let latestSnapshot: MarkFlowEditorSnapshot | null = null
      let latestContent = getCurrentTabContent(tab)
      if (tabId === activeTabIdRef.current) {
        latestSnapshot = editorRef.current?.captureSnapshot() ?? null
        latestContent = editorRef.current?.getContent() ?? latestContent
        if (latestSnapshot) {
          const nextSnapshot = latestSnapshot
          updateTab(tabId, (currentTab) => ({
            ...currentTab,
            content: latestContent,
            isDirty: latestContent !== currentTab.persistedContent,
            snapshot: nextSnapshot,
            collapsedRanges: areCollapsedRangesEqual(currentTab.collapsedRanges, nextSnapshot.collapsedRanges)
              ? currentTab.collapsedRanges
              : [...nextSnapshot.collapsedRanges],
          }))
        }
      }

      const currentTabs = tabsRef.current.map((currentTab) =>
        currentTab.id === tabId
          ? {
              ...currentTab,
              snapshot: latestSnapshot ?? currentTab.snapshot,
            }
          : currentTab,
      )
      await syncWindowSession(currentTabs, tabId)

      const result = forceSaveAs
        ? await api.saveFileAs(latestContent, tab.recoveryTabId ?? tabId)
        : await api.saveFile(latestContent, tab.recoveryTabId ?? tabId)
      if (!result?.success) {
        return false
      }

      const nextFilePath = result.filePath ?? tab.filePath
      if (nextFilePath) {
        await api.saveFoldState(nextFilePath, latestSnapshot?.collapsedRanges ?? tab.collapsedRanges)
      }

      updateTab(tabId, (currentTab) => ({
        ...currentTab,
        recoveryTabId: null,
        filePath: nextFilePath ?? currentTab.filePath,
        content: latestContent,
        persistedContent: latestContent,
        isDirty: false,
      }))
      scheduleRecoveryCheckpoint()
      return true
    },
    [getCurrentTabContent, scheduleRecoveryCheckpoint, syncWindowSession, updateTab],
  )

  const handleCloseTab = useCallback(
    async (tabId: string | null) => {
      if (!tabId) {
        return false
      }

      const tab = tabsRef.current.find((currentTab) => currentTab.id === tabId)
      if (!tab) {
        return false
      }

      let closedTab = tab
      if (tabId === activeTabIdRef.current) {
        const snapshot = editorRef.current?.captureSnapshot()
        if (snapshot) {
          closedTab = {
            ...tab,
            snapshot,
            collapsedRanges: areCollapsedRangesEqual(tab.collapsedRanges, snapshot.collapsedRanges)
              ? tab.collapsedRanges
              : [...snapshot.collapsedRanges],
          }
        }
      }

      if (closedTab.isDirty) {
        const api = window.markflow
        const label = getTabLabel(closedTab, loadingFile)
        const decision: MarkFlowTabCloseAction = api ? await api.confirmTabClose(label) : 'cancel'
        if (decision === 'cancel') {
          return false
        }

        if (decision === 'save') {
          const didSave = await handleSaveTab(tabId)
          if (!didSave) {
            return false
          }

          const savedTab = tabsRef.current.find((currentTab) => currentTab.id === tabId)
          if (savedTab) {
            closedTab = {
              ...savedTab,
              snapshot: closedTab.snapshot,
            }
          }
        } else if (decision === 'discard') {
          if (closedTab.filePath == null) {
            closedTab = {
              ...closedTab,
              content: '',
              persistedContent: '',
              isDirty: false,
            }
          } else {
            closedTab = {
              ...closedTab,
              content: closedTab.persistedContent,
              isDirty: false,
            }
          }
        }
      }

      const currentTabs = tabsRef.current
      const closedIndex = findTabIndex(currentTabs, tabId)
      const nextTabs = currentTabs.filter((currentTab) => currentTab.id !== tabId)
      const fallbackTab = nextTabs[Math.min(closedIndex, Math.max(nextTabs.length - 1, 0))] ?? null

      setClosedTabs((currentClosedTabs) => [{ closedIndex, tab: closedTab }, ...currentClosedTabs].slice(0, 20))
      replaceTabs(nextTabs.length > 0 ? nextTabs : [createDocumentTab(null, '')])
      replaceActiveTabId(nextTabs.length > 0 ? fallbackTab?.id ?? null : null)
      clearEditorNavigationRequest()
      closeGoToLine()
      return true
    },
    [clearEditorNavigationRequest, closeGoToLine, handleSaveTab, loadingFile, replaceActiveTabId, replaceTabs],
  )

  const handleReopenClosedTab = useCallback(async () => {
    const [mostRecentClosedTab, ...remainingClosedTabs] = closedTabs
    if (!mostRecentClosedTab) {
      return false
    }

    const existingTab = mostRecentClosedTab.tab.filePath
      ? tabsRef.current.find((tab) => tab.filePath === mostRecentClosedTab.tab.filePath)
      : null
    if (existingTab) {
      setClosedTabs(remainingClosedTabs)
      handleSwitchTab(existingTab.id)
      return true
    }

    const nextTabs = [...tabsRef.current]
    const insertIndex = Math.max(0, Math.min(mostRecentClosedTab.closedIndex, nextTabs.length))
    nextTabs.splice(insertIndex, 0, mostRecentClosedTab.tab)
    setClosedTabs(remainingClosedTabs)
    replaceTabs(nextTabs)
    replaceActiveTabId(mostRecentClosedTab.tab.id)
    return true
  }, [closedTabs, handleSwitchTab, replaceActiveTabId, replaceTabs])

  useEffect(() => {
    handleNavigateBackRef.current = handleNavigateBack
    handleNavigateForwardRef.current = handleNavigateForward
    handleCycleTabsRef.current = handleCycleTabs
    handleOpenFolderPathRef.current = handleOpenFolderPath
    handleOpenQuickOpenRef.current = handleOpenQuickOpen
    handleSaveTabRef.current = handleSaveTab
    handleCloseTabRef.current = handleCloseTab
    handleReopenClosedTabRef.current = handleReopenClosedTab
  }, [
    handleCloseTab,
    handleCycleTabs,
    handleNavigateBack,
    handleNavigateForward,
    handleOpenFolderPath,
    handleOpenQuickOpen,
    handleReopenClosedTab,
    handleSaveTab,
  ])

  const totalLines = activeTab?.largeFile?.totalLines ?? 0

  const currentLineNumber = activeTab?.largeFile
    ? Math.min(activeTab.largeFile.totalLines, activeTab.largeFile.windowStartLine + activeCursorLineNumber - 1)
    : activeCursorLineNumber

  const windowSessionKey = useMemo(
    () => tabs.map((tab) => tab.filePath ?? '').join('\u0000'),
    [tabs],
  )

  useEffect(() => {
    if (!activeTabId) {
      return
    }

    void syncWindowSession(tabsRef.current, activeTabId)
  }, [activeTabId, syncWindowSession, windowSessionKey])

  useEffect(() => {
    if (tabs.some((tab) => tab.isDirty && tab.largeFile == null)) {
      return
    }

    clearRecoveryCheckpointTimer()
  }, [clearRecoveryCheckpointTimer, tabs])

  useEffect(() => () => {
    clearRecoveryCheckpointTimer()
  }, [clearRecoveryCheckpointTimer])

  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      if (e.defaultPrevented) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const lowerKey = e.key.toLowerCase()
      const isCommandPaletteKey = isMac
        ? e.metaKey && e.shiftKey && lowerKey === 'p'
        : e.ctrlKey && e.shiftKey && lowerKey === 'p'
      const isQuickOpenKey = isMac
        ? e.metaKey && e.shiftKey && lowerKey === 'o'
        : e.ctrlKey && lowerKey === 'p'
      const isDocumentSearchKey = isMac
        ? e.metaKey && !e.shiftKey && lowerKey === 'f'
        : e.ctrlKey && !e.shiftKey && lowerKey === 'f'

      const isGlobalSearchKey = isMac
        ? e.metaKey && e.shiftKey && lowerKey === 'f'
        : e.ctrlKey && e.shiftKey && lowerKey === 'f'
      const isGoToLineKey = isMac
        ? e.metaKey && !e.shiftKey && lowerKey === 'l'
        : e.ctrlKey && !e.shiftKey && lowerKey === 'l'
      const isNavigateBackKey =
        !e.shiftKey &&
        !e.altKey &&
        ((isMac && e.metaKey && e.key === '[') || (!isMac && e.ctrlKey && e.key === '['))
      const isNavigateForwardKey =
        !e.shiftKey &&
        !e.altKey &&
        ((isMac && e.metaKey && e.key === ']') || (!isMac && e.ctrlKey && e.key === ']'))
      const isNextTabKey = (!isMac && e.ctrlKey && e.key === 'Tab' && !e.shiftKey) || (e.metaKey && e.key === '`' && !e.shiftKey)
      const isPreviousTabKey =
        (!isMac && e.ctrlKey && e.key === 'Tab' && e.shiftKey) || (e.metaKey && e.key === '`' && e.shiftKey)
      const isReopenClosedTabKey = e.shiftKey && ((e.metaKey && lowerKey === 't') || (e.ctrlKey && lowerKey === 't'))

      if (isCommandPaletteKey) {
        e.preventDefault()
        handleOpenCommandPalette()
      } else if (isNavigateBackKey) {
        e.preventDefault()
        await handleNavigateBack()
      } else if (isNavigateForwardKey) {
        e.preventDefault()
        await handleNavigateForward()
      } else if (isNextTabKey) {
        e.preventDefault()
        handleCycleTabs(1)
      } else if (isPreviousTabKey) {
        e.preventDefault()
        handleCycleTabs(-1)
      } else if (isReopenClosedTabKey) {
        e.preventDefault()
        await handleReopenClosedTab()
      } else if (isDocumentSearchKey) {
        e.preventDefault()
        handleOpenDocumentSearch()
      } else if (isQuickOpenKey) {
        e.preventDefault()
        await handleOpenQuickOpen()
      } else if (isGlobalSearchKey) {
        e.preventDefault()
        handleToggleGlobalSearch()
      } else if (isGoToLineKey) {
        e.preventDefault()
        handleOpenGoToLine()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    handleCycleTabs,
    handleNavigateBack,
    handleNavigateForward,
    handleOpenDocumentSearch,
    handleOpenCommandPalette,
    handleOpenGoToLine,
    handleOpenQuickOpen,
    handleReopenClosedTab,
    handleToggleGlobalSearch,
  ])

  const handleQuickOpenSelect = async (item: MarkFlowQuickOpenItem) => {
    closeQuickOpen()
    if (item.kind === 'folder') {
      await handleOpenFolderPath(item.filePath)
      return
    }

    await handleOpenPath(item.filePath)
  }


  const handlePandocExport = async (action: 'export-docx' | 'export-epub' | 'export-latex') => {
    const api = window.markflow
    if (!api || !activeTab || activeTab.largeFile) return
    const exportContent = getCurrentTabContent(activeTab)

    const ext = action === 'export-docx' ? 'docx' : action === 'export-epub' ? 'epub' : 'tex'
    const defaultName = activeTab.filePath
      ? activeTab.filePath.replace(/\.(md|markdown|txt)$/i, '') + '.' + ext
      : `Untitled.${ext}`

    if (action === 'export-docx') {
      await api.exportDocx(exportContent, defaultName)
    } else if (action === 'export-epub') {
      await api.exportEpub(exportContent, defaultName)
    } else {
      await api.exportLatex(exportContent, defaultName)
    }
  }

  const handleExport = async (format: 'html' | 'pdf') => {
    if (!activeTab || activeTab.largeFile) {
      return
    }

    const exportContent = getCurrentTabContent(activeTab)

    setIsExporting(true)
    try {
      // Wait a couple of frames for the React state to render the unconstrained editor.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => setTimeout(resolve, 100))

      const exportEl = document.getElementById('mf-export-container')
      const cmContent = exportEl?.querySelector<HTMLElement>('.cm-content')
      if (!cmContent) {
        return
      }

      const html = serializeRenderedDocumentForExport({
        content: exportContent,
        document,
        headingNumberingEnabled,
        markdownMode,
        renderedRoot: cmContent,
        title: activeTab.filePath ? activeTab.filePath.split('/').pop() ?? 'Export' : 'Export',
      })

      const api = window.markflow
      if (!api) {
        return
      }

      const defaultName = activeTab.filePath
        ? activeTab.filePath.replace(/\.(md|markdown|txt)$/i, '') + '.' + format
        : 'Untitled.' + format

      if (format === 'html') {
        await api.exportHtml(html, defaultName)
      } else {
        await api.exportPdf(html, defaultName)
      }
    } finally {
      setIsExporting(false)
    }
  }

  const updateHeadingNumberingPreference = useCallback((enabled: boolean) => {
    persistLocalHeadingNumberingPreference(enabled)
    setHeadingNumberingEnabled(enabled)
  }, [])

  const updateSourceLineNumbersPreference = useCallback((enabled: boolean) => {
    persistLocalSourceLineNumbersPreference(enabled)
    setSourceLineNumbersEnabled(enabled)
  }, [])

  const replaceTabTextOccurrence = useCallback(
    (tabId: string, searchText: string, replacementText: string, occurrenceIndex: number) => {
      let didReplace = false
      if (activeTabIdRef.current === tabId) {
        didReplace = editorRef.current?.replaceTextOccurrence(searchText, replacementText, occurrenceIndex) ?? false
      }

      updateTab(tabId, (tab) => {
        const nextContent =
          activeTabIdRef.current === tabId && didReplace
            ? getCurrentTabContent(tab)
            : replaceNthOccurrence(tab.content, searchText, replacementText, occurrenceIndex)
        if (nextContent == null || nextContent === tab.content) {
          return tab
        }

        didReplace = true
        return {
          ...tab,
          content: nextContent,
          isDirty: nextContent !== tab.persistedContent,
        }
      })

      return didReplace
    },
    [getCurrentTabContent, updateTab],
  )

  const persistImageUploadSettings = useCallback(
    async (nextSettings: MarkFlowImageUploadSettings) => {
      const api = window.markflow
      if (!api) {
        setImageUploadSettings(nextSettings)
        return
      }

      const persistedSettings = await api.setImageUploadSettings(nextSettings)
      setImageUploadSettings(persistedSettings)
    },
    [],
  )

  const updateImageUploadSettings = useCallback(
    (patch: Partial<MarkFlowImageUploadSettings>) => {
      if (!imageUploadSettings) {
        return
      }

      void persistImageUploadSettings({
        ...imageUploadSettings,
        ...patch,
      })
    },
    [imageUploadSettings, persistImageUploadSettings],
  )

  useEffect(() => {
    const shell = editorShellRef.current
    const api = window.markflow
    if (!shell || !api) {
      return
    }

    const handleImageInsert = (event: Event) => {
      const detail = (event as CustomEvent<EditorImageInsertDetail>).detail
      const currentActiveTabId = activeTabIdRef.current
      const currentTab = currentActiveTabId
        ? tabsRef.current.find((tab) => tab.id === currentActiveTabId) ?? null
        : null

      if (!currentActiveTabId || !currentTab || currentTab.largeFile) {
        return
      }

      const documentFilePath = currentTab.filePath
      void (async () => {
        try {
          const sourcePath =
            typeof detail.file.path === 'string' && detail.file.path.length > 0 ? detail.file.path : null
          const imageBuffer = sourcePath
            ? null
            : typeof detail.file.arrayBuffer === 'function'
              ? await detail.file.arrayBuffer()
              : await new Response(detail.file).arrayBuffer()
          const data = imageBuffer ? new Uint8Array(imageBuffer) : undefined
          const ingestResult = await api.ingestImage({
            fileName: detail.file.name || 'image.png',
            mimeType: detail.file.type || 'image/png',
            documentFilePath,
            sourcePath,
            data,
          })
          const localMarkdown = rewriteImageMarkdownSource(
            detail.markdownText,
            ingestResult.markdownSource,
          )

          replaceTabTextOccurrence(
            currentActiveTabId,
            detail.markdownText,
            localMarkdown,
            detail.occurrenceIndex,
          )

          if (!imageUploadSettings?.autoUploadOnInsert || imageUploadSettings.uploaderKind === 'disabled') {
            return
          }

          const uploadResult = await api.uploadImage({
            filePath: ingestResult.localFilePath,
            documentFilePath,
          })
          if (!uploadResult.success || !uploadResult.remoteUrl) {
            showToast(uploadResult.error ?? 'Image upload failed.')
            return
          }

          const remoteMarkdown = rewriteImageMarkdownSource(localMarkdown, uploadResult.remoteUrl)
          replaceTabTextOccurrence(currentActiveTabId, localMarkdown, remoteMarkdown, 0)
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : 'Image upload failed before the local asset was preserved.',
          )
        }
      })()
    }

    shell.addEventListener('mf-image-paste', handleImageInsert as EventListener)
    shell.addEventListener('mf-image-drop', handleImageInsert as EventListener)
    return () => {
      shell.removeEventListener('mf-image-paste', handleImageInsert as EventListener)
      shell.removeEventListener('mf-image-drop', handleImageInsert as EventListener)
    }
  }, [imageUploadSettings, replaceTabTextOccurrence, showToast])

  const handleDocumentEdit = useCallback(() => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => {
      if (tab.largeFile || tab.isDirty) {
        return tab
      }

      return {
        ...tab,
        isDirty: true,
      }
    })
    scheduleRecoveryCheckpoint()
  }, [scheduleRecoveryCheckpoint, updateTab])

  function handleContentChange(content: string) {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => {
      if (tab.largeFile) {
        return tab
      }

      const isDirty = content !== tab.persistedContent
      if (tab.content === content && tab.isDirty === isDirty) {
        return tab
      }

      return {
        ...tab,
        content,
        isDirty,
      }
    })
  }

  function handleSelectionChange(nextSelectionText: string) {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) =>
      tab.selectionText === nextSelectionText
        ? tab
        : {
            ...tab,
            selectionText: nextSelectionText,
          },
    )
  }

  async function handleCopyAction(action: 'copy' | 'copy-as-markdown' | 'copy-as-html-code') {
    const api = window.markflow
    if (!api) return

    if (!isEditorCopyContext()) {
      if (action === 'copy' && typeof document.execCommand === 'function') {
        document.execCommand('copy')
      }
      return
    }

    const markdownSelection = activeTab?.selectionText ?? ''
    if (markdownSelection.length === 0) {
      return
    }

    if (action === 'copy-as-markdown') {
      await api.writeClipboard({ text: markdownSelection })
      return
    }

    const serializedSelection = serializeMarkdownSelectionForClipboard(markdownSelection)

    if (action === 'copy') {
      await api.writeClipboard({
        html: serializedSelection.html,
        text: serializedSelection.text,
      })
      return
    }

    await api.writeClipboard({ text: serializedSelection.html })
  }

  async function handleSpellCheckLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLanguage = event.target.value || null
    const api = window.markflow

    if (api) {
      const nextState = await api.setSpellCheckLanguage(nextLanguage)
      applySpellCheckState(nextState)
      return
    }

    updateLocalSpellCheckState((currentState) => ({
      ...currentState,
      selectedLanguage: nextLanguage,
    }))
  }

  async function handleSpellCheckWordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextWord = sanitizeSpellCheckWord(spellCheckWordInput)
    if (!nextWord) {
      return
    }

    const api = window.markflow
    if (api) {
      const nextState = await api.addSpellCheckWord(nextWord)
      applySpellCheckState(nextState)
    } else {
      updateLocalSpellCheckState((currentState) => ({
        ...currentState,
        customWords: [...currentState.customWords, nextWord],
      }))
    }

    setSpellCheckWordInput('')
  }

  async function handleSpellCheckWordRemove(word: string) {
    const api = window.markflow

    if (api) {
      const nextState = await api.removeSpellCheckWord(word)
      applySpellCheckState(nextState)
      return
    }

    updateLocalSpellCheckState((currentState) => ({
      ...currentState,
      customWords: currentState.customWords.filter((currentWord) => currentWord !== word),
    }))
  }

  useEffect(() => {
    handleCopyActionRef.current = handleCopyAction
    handleExportRef.current = handleExport
    handlePandocExportRef.current = handlePandocExport
  }, [handleCopyAction, handleExport, handlePandocExport])

  const { commandPaletteActions, handleCommandPaletteSelect } = useCommandPaletteActions({
    activeTabIdRef,
    closeCommandPalette,
    editorRef,
    focusMode,
    handleCopyAction,
    handleExport,
    handleNavigateBack,
    handleNavigateForward,
    handleOpenFolder,
    handleOpenGlobalSearch,
    handleOpenGoToLine,
    handleOpenQuickOpen,
    handlePandocExport,
    handleSaveTab,
    isDistractionFreeMode,
    isDocumentStatisticsOpen,
    outlineCollapsed,
    setOutlineCollapsed,
    setShowMinimap,
    showMinimap,
    toggleDistractionFreeMode,
    toggleDocumentStatistics,
    toggleFocusMode,
    toggleTypewriterMode,
    toggleViewMode,
    typewriterMode,
    viewMode,
  })

  const outlineHeadings = activeTab?.largeFile ? [] : activeTab?.symbolTable.headings ?? []

  const activeOutlineAnchor = useMemo(
    () => {
      if (!activeTab) {
        return null
      }

      const tabCursorPosition = activeTab.cursorPosition
      const tabViewportPosition = activeTab.viewportPosition ?? tabCursorPosition
      const lookupPosition =
        activeOutlineAnchorSource === 'viewport' ? tabViewportPosition : tabCursorPosition

      return findActiveHeadingAnchor(outlineHeadings, lookupPosition)
    },
    [activeTab, activeOutlineAnchorSource, outlineHeadings],
  )

  useEffect(() => {
    setActiveOutlineAnchorSource('cursor')
  }, [activeTab?.id])

  const handleSymbolTableChange = useCallback((table: SymbolTable) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    startTransition(() => {
      updateTab(currentActiveTabId, (tab) => {
        if (tab.largeFile) {
          return tab
        }

        return {
          ...tab,
          symbolTable: table,
        }
      })
    })
  }, [updateTab])

  const handleCollapsedRangesChange = useCallback((nextRanges: number[]) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    startTransition(() => {
      updateTab(currentActiveTabId, (tab) => {
        if (tab.largeFile || areCollapsedRangesEqual(tab.collapsedRanges, nextRanges)) {
          return tab
        }

        return {
          ...tab,
          collapsedRanges: [...nextRanges],
        }
      })
    })
  }, [updateTab])

  const handleCursorPositionChange = useCallback((position: number, lineNumber: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    startTransition(() => {
      setActiveCursorLineNumber(lineNumber)
      setActiveOutlineAnchorSource('cursor')
      updateTab(currentActiveTabId, (tab) =>
        tab.cursorPosition === position
          ? tab
          : {
              ...tab,
              cursorPosition: position,
            },
      )
    })
  }, [updateTab])

  const handleViewportPositionChange = useCallback((position: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    startTransition(() => {
      setActiveOutlineAnchorSource('viewport')
      updateTab(currentActiveTabId, (tab) =>
        tab.viewportPosition === position
          ? tab
          : {
              ...tab,
              viewportPosition: position,
            },
      )
    })
  }, [updateTab])

  const handleScrollMetricsChange = useCallback((metrics: MinimapScrollMetrics) => {
    setEditorScrollMetrics((current) => {
      if (
        current &&
        current.scrollTop === metrics.scrollTop &&
        current.scrollHeight === metrics.scrollHeight &&
        current.clientHeight === metrics.clientHeight
      ) {
        return current
      }

      return metrics
    })
  }, [])

  const activeDocumentName = activeTab ? getTabLabel(activeTab, loadingFile) : 'Untitled'
  const largeFileNotice = activeTab?.largeFile
    ? `Large-file mode: showing lines ${activeTab.largeFile.windowStartLine.toLocaleString()}-${activeTab.largeFile.windowEndLine.toLocaleString()} of ${activeTab.largeFile.totalLines.toLocaleString()}. Editing and export stay disabled to keep memory bounded.`
    : null
  const recentSidebarItems = useMemo(
    () => quickOpenItems.filter((item) => item.isRecent).slice(0, 6),
    [quickOpenItems],
  )
  const shouldShowTabstrip = !isImmersiveMode && tabs.length > 1

  const loadingProgressPercent = loadingFile
    ? Math.min(100, Math.round((loadingFile.bytesRead / Math.max(loadingFile.totalBytes, 1)) * 100))
    : 0
  const appClassName = [
    'mf-app',
    isImmersiveMode ? 'mf-app-immersive' : '',
    windowState.isFullscreen ? 'mf-app-fullscreen' : '',
    isDistractionFreeMode ? 'mf-app-distraction-free' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const handleToggleSidebar = useCallback(() => {
    setShowSidebar((current) => {
      const next = !current
      if (next) {
        void refreshQuickOpenItems()
      }
      return next
    })
  }, [refreshQuickOpenItems])

  return (
    <div className={appClassName} {...{ [HEADING_NUMBERING_ATTRIBUTE]: headingNumberingEnabled ? 'true' : 'false' }}>
      <style id={HEADING_NUMBERING_STYLE_ELEMENT_ID}>{HEADING_NUMBERING_CSS}</style>
      {!isImmersiveMode ? (
        <header className="mf-titlebar">
        {/* Spacer for macOS traffic lights (hiddenInset titleBarStyle) */}
        <div className="mf-titlebar-traffic-spacer" />
        <div className="mf-titlebar-left">
          <svg className="mf-logo-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 13L5.5 5.5L9 10.5L12.5 7.5L16 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="9" cy="3" r="1.3" fill="currentColor" opacity="0.7"/>
          </svg>
          <span className="mf-titlebar-appname">MarkFlow</span>
        </div>
        <div className="mf-titlebar-center">
          <span className="mf-titlebar-document">
            <span className="mf-titlebar-document-name">{activeDocumentName}</span>
            {activeTab?.isDirty && (
              <span className="mf-titlebar-dirty-dot" aria-label="Unsaved changes" />
            )}
          </span>
        </div>
        <div className="mf-titlebar-right">
          <button
            className={`mf-mode-toggle mf-mode-toggle-utility${typewriterMode ? ' mf-mode-active' : ''}`}
            onClick={toggleTypewriterMode}
            title="Typewriter mode (Ctrl+Shift+T)"
            aria-label="Typewriter mode"
            aria-pressed={typewriterMode}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="3" width="10" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.1" fill="none"/>
              <rect x="3" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="5.4" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="7.8" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="3.8" y="7.5" width="4.4" height="1" rx="0.3" fill="currentColor" opacity="0.5"/>
              <rect x="3.5" y="1.2" width="5" height="1.2" rx="0.6" fill="currentColor" opacity="0.3"/>
            </svg>
          </button>
          <button
            className={`mf-mode-toggle mf-mode-toggle-utility${focusMode ? ' mf-mode-active' : ''}`}
            onClick={toggleFocusMode}
            title="Focus mode (Ctrl+Shift+F)"
            aria-label="Focus mode"
            aria-pressed={focusMode}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="6" cy="6" r="2" fill="currentColor"/>
              <path d="M1 3V1.5A0.5 0.5 0 0 1 1.5 1H3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M9 1H10.5A0.5 0.5 0 0 1 11 1.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M11 9V10.5A0.5 0.5 0 0 1 10.5 11H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M3 11H1.5A0.5 0.5 0 0 1 1 10.5V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`mf-mode-toggle${showSidebar ? ' mf-mode-active' : ''}`}
            onClick={handleToggleSidebar}
            title="Toggle file sidebar"
            aria-label="Toggle file sidebar"
            aria-pressed={showSidebar}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none"/>
              <line x1="4.5" y1="1" x2="4.5" y2="11" stroke="currentColor" strokeWidth="1.1"/>
              <line x1="1.5" y1="4" x2="4" y2="4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="1.5" y1="6" x2="4" y2="6" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="1.5" y1="8" x2="3.5" y2="8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
            </svg>
            Files
          </button>
          {/* Segmented control for view mode */}
          <div className="mf-segment-control" role="group" aria-label="View mode">
            <button
              className={`mf-segment-btn${viewMode === 'wysiwyg' ? ' mf-segment-active' : ''}`}
              onClick={() => setViewMode('wysiwyg')}
              title="WYSIWYG mode"
              aria-label="Preview mode"
              aria-pressed={viewMode === 'wysiwyg'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="1" y="1.5" width="4" height="1.4" rx="0.5" fill="currentColor" opacity="0.75"/>
                <rect x="1" y="4.3" width="7" height="1.4" rx="0.5" fill="currentColor" opacity="0.55"/>
                <rect x="1" y="7.1" width="5.5" height="1.4" rx="0.5" fill="currentColor" opacity="0.55"/>
                <rect x="1" y="9.9" width="8" height="1.4" rx="0.5" fill="currentColor" opacity="0.35"/>
              </svg>
              Preview
            </button>
            <button
              className={`mf-segment-btn${viewMode === 'source' ? ' mf-segment-active' : ''}`}
              onClick={() => setViewMode('source')}
              title="Source mode"
              aria-label="Source mode"
              aria-pressed={viewMode === 'source'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M4 3L1.5 6L4 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 3L10.5 6L8 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 2L5.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
              </svg>
              Source
            </button>
            <button
              className={`mf-segment-btn${viewMode === 'reading' ? ' mf-segment-active' : ''}`}
              onClick={() => setViewMode('reading')}
              title="Reading mode"
              aria-label="Reading mode"
              aria-pressed={viewMode === 'reading'}
            >
              Reading
            </button>
            <button
              className={`mf-segment-btn${viewMode === 'split' ? ' mf-segment-active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split view"
              aria-label="Split view"
              aria-pressed={viewMode === 'split'}
            >
              Split
            </button>
          </div>
        </div>
        </header>
      ) : null}
      {shouldShowTabstrip ? (
        <div className="mf-tabstrip" role="tablist" aria-label="Open documents">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab?.id
          const tabLabel = getTabLabel(tab)

          return (
            <div key={tab.id} className={`mf-tab${isActive ? ' mf-tab-active' : ''}`}>
              <button
                type="button"
                role="tab"
                className="mf-tab-button"
                aria-selected={isActive}
                onClick={() => handleSwitchTab(tab.id)}
              >
                {tab.isDirty ? <span className="mf-tab-dirty-dot" aria-hidden="true" /> : null}
                <span className="mf-tab-label">{tabLabel}</span>
              </button>
              <button
                type="button"
                className="mf-tab-close"
                aria-label={`Close ${tabLabel}`}
                onClick={(event) => {
                  event.stopPropagation()
                  void handleCloseTab(tab.id)
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18"/>
                </svg>
              </button>
            </div>
          )
        })}
        </div>
      ) : null}
      <main className="mf-main">
        {showSidebar && !isImmersiveMode ? (
          <div className="mf-sidebar">
            <VaultSidebar
              folderPath={vaultPath}
              files={vaultFiles}
              activeFile={activeTab?.filePath ?? null}
              recentItems={recentSidebarItems}
              outlineItems={outlineHeadings}
              activeOutlineAnchor={activeOutlineAnchor}
              onFileOpen={(fp) => void handleOpenPath(fp)}
              onFileRename={(old, newName) => void handleVaultFileRename(old, newName)}
              onFileDelete={(fp) => void handleVaultFileDelete(fp)}
              onOpenFolder={() => void handleOpenFolder()}
              onRecentSelect={handleQuickOpenSelect}
              onOutlineSelect={handleOutlineNavigate}
              outlineCollapsed={outlineCollapsed}
              onToggleOutline={() => setOutlineCollapsed((v) => !v)}
            />
          </div>
        ) : null}
        <div className="mf-body">
          <div ref={editorShellRef} className="mf-editor-shell">
            <DocumentSearch
              isOpen={isDocumentSearchOpen}
              query={documentSearchQuery}
              matchCount={documentSearchMatchCount}
              onChange={setDocumentSearchQuery}
              onClose={handleCloseDocumentSearch}
              onNext={handleNextDocumentSearchMatch}
              onPrevious={handlePreviousDocumentSearchMatch}
            />
            {loadingFile ? (
              <section className="mf-file-loading" aria-live="polite">
                <div className="mf-file-loading-header">
                  <div>
                    <p className="mf-file-loading-label">Opening large file</p>
                    <p className="mf-file-loading-meta">
                      {formatLoadingBytes(loadingFile.bytesRead)} of {formatLoadingBytes(loadingFile.totalBytes)}
                    </p>
                  </div>
                  <strong className="mf-file-loading-percent">{loadingProgressPercent}%</strong>
                </div>
                <div
                  className="mf-file-loading-bar"
                  role="progressbar"
                  aria-label="Large file loading progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={loadingProgressPercent}
                >
                  <span style={{ width: `${loadingProgressPercent}%` }} />
                </div>
                <pre className="mf-file-loading-preview">{loadingFile.previewContent}</pre>
              </section>
            ) : null}
            {largeFileNotice ? (
              <section className="mf-large-file-banner" aria-live="polite">
                {largeFileNotice}
              </section>
            ) : null}
            {activeTab ? (
              <MarkFlowEditor
                key={activeTab.id}
                ref={editorRef}
                initialSnapshot={activeTab.snapshot}
                content={activeTab.content}
                editable={activeTab.largeFile == null}
                markdownMode={markdownMode}
                spellCheckLanguage={spellCheckState.selectedLanguage}
                viewMode={viewMode}
                showSourceLineNumbers={sourceLineNumbersEnabled}
                onChange={handleContentChange}
                onDocumentEdit={handleDocumentEdit}
                onCursorPositionChange={handleCursorPositionChange}
                onViewportPositionChange={handleViewportPositionChange}
                onScrollMetricsChange={handleScrollMetricsChange}
                onSymbolTableChange={handleSymbolTableChange}
                onNavigationHandled={clearEditorNavigationRequest}
                onOpenPath={(filePath) => handleOpenPath(filePath, { pushHistory: true })}
                onOpenDocumentSearch={handleOpenDocumentSearch}
                onToggleMode={toggleViewMode}
                onSelectionChange={handleSelectionChange}
                onToggleFocusMode={toggleFocusMode}
                onToggleTypewriterMode={toggleTypewriterMode}
                focusMode={focusMode}
                typewriterMode={typewriterMode}
                pluginHost={pluginHostRef.current ?? undefined}
                filePath={activeTab.filePath ?? undefined}
                navigationRequest={editorNavigationRequest}
                collapsedRanges={activeTab.collapsedRanges}
                onCollapsedRangesChange={handleCollapsedRangesChange}
              />
            ) : null}
          </div>
          {showMinimap && !isImmersiveMode && activeTab && !activeTab.largeFile ? (
            <Minimap
              content={activeTab.content}
              scrollMetrics={editorScrollMetrics}
              onNavigate={handleMinimapNavigate}
            />
          ) : null}
          {outlineHeadings.length > 0 && !isImmersiveMode && !showSidebar ? (
            <aside className={`mf-outline-panel${outlineCollapsed ? ' mf-outline-panel-collapsed' : ''}`}>
              <div className="mf-outline-header">
                {!outlineCollapsed && <span className="mf-outline-header-label">Outline</span>}
                <button
                  type="button"
                  className="mf-outline-toggle"
                  onClick={() => setOutlineCollapsed((v) => !v)}
                  title={outlineCollapsed ? 'Expand outline' : 'Collapse outline'}
                  aria-label={outlineCollapsed ? 'Expand outline' : 'Collapse outline'}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    {outlineCollapsed
                      ? <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      : <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    }
                  </svg>
                </button>
              </div>
              {!outlineCollapsed && (
                <nav className="mf-outline-nav" aria-label="Outline">
                  {outlineHeadings.map((heading) => {
                    const isActive = heading.anchor === activeOutlineAnchor

                    return (
                      <button
                        key={`${heading.anchor}:${heading.from}`}
                        type="button"
                        className={`mf-outline-item${isActive ? ' mf-outline-item-active' : ''}`}
                        {...{ [HEADING_NUMBERING_OUTLINE_LEVEL_ATTRIBUTE]: String(heading.level) }}
                        style={{ paddingLeft: `${12 + (heading.level - 1) * 14}px` }}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => handleOutlineNavigate(heading.from)}
                      >
                        <span className="mf-outline-item-text">{heading.text}</span>
                      </button>
                    )
                  })}
                </nav>
              )}
            </aside>
          ) : null}
        </div>
      </main>
      {!isImmersiveMode ? (
        <AppStatusBar
          activeTab={activeTab}
          currentLineNumber={currentLineNumber}
          totalLines={totalLines}
          markdownMode={markdownMode}
          statisticsPreferences={statisticsPreferences}
          updateStatisticsPreferences={updateStatisticsPreferences}
          updateMarkdownModePreference={updateMarkdownModePreference}
          headingNumberingEnabled={headingNumberingEnabled}
          updateHeadingNumberingPreference={updateHeadingNumberingPreference}
          sourceLineNumbersEnabled={sourceLineNumbersEnabled}
          updateSourceLineNumbersPreference={updateSourceLineNumbersPreference}
          spellCheckState={spellCheckState}
          handleSpellCheckLanguageChange={handleSpellCheckLanguageChange}
          spellCheckWordInput={spellCheckWordInput}
          setSpellCheckWordInput={setSpellCheckWordInput}
          handleSpellCheckWordSubmit={handleSpellCheckWordSubmit}
          handleSpellCheckWordRemove={handleSpellCheckWordRemove}
          imageUploadSettings={imageUploadSettings}
          updateImageUploadSettings={updateImageUploadSettings}
          panelState={statusBarPanels}
        />
      ) : null}
      {toasts.length > 0 ? (
        <div className="mf-toast-stack" aria-live="assertive" aria-label="Notifications">
          {toasts.map((toast) => (
            <div key={toast.id} className="mf-toast" role="alert">
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        actions={commandPaletteActions}
        onClose={closeCommandPalette}
        onSelect={(action: RegisteredCommandPaletteAction) => void handleCommandPaletteSelect(action)}
      />

      <QuickOpen
        isOpen={isQuickOpenOpen}
        items={quickOpenItems}
        onClose={closeQuickOpen}
        onSelect={handleQuickOpenSelect}
      />

      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        folderPath={vaultPath}
        onClose={closeGlobalSearch}
        onSelectResult={handleGlobalSearchResult}
      />

      <GoToLine
        isOpen={isGoToLineOpen}
        currentLine={currentLineNumber}
        totalLines={totalLines}
        onClose={closeGoToLine}
        onSubmit={handleGoToLine}
      />

      {isExporting && (
        <div id="mf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', height: 'auto' }}>
          <MarkFlowEditor
            content={activeTab?.content ?? ''}
            markdownMode={markdownMode}
            spellCheckLanguage={spellCheckState.selectedLanguage}
            viewMode="wysiwyg"
            onChange={() => {}}
            onCursorPositionChange={() => {}}
            onViewportPositionChange={() => {}}
            onSymbolTableChange={() => {}}
            onNavigationHandled={() => {}}
            onOpenPath={async () => {}}
            onToggleMode={() => {}}
            onSelectionChange={() => {}}
            onToggleFocusMode={() => {}}
            onToggleTypewriterMode={() => {}}
            focusMode={false}
            typewriterMode={false}
            pluginHost={pluginHostRef.current ?? undefined}
            filePath={activeTab?.filePath ?? undefined}
            navigationRequest={null}
          />
        </div>
      )}
    </div>
  )
}
