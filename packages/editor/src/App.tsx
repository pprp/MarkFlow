import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MarkFlowEditor,
  type MarkFlowEditorHandle,
  type MarkFlowEditorSnapshot,
} from './editor/MarkFlowEditor'
import { createEmptySymbolTable, type SymbolTable } from './editor/indexer'
import {
  canNavigateBack,
  canNavigateForward,
  createEmptyNavigationHistory,
  navigateBackInHistory,
  navigateForwardInHistory,
  pushNavigationHistoryEntry,
  type NavigationLocation,
} from './editor/navigationHistory'
import { fileUrlToPath, resolveLinkHref } from './editor/decorations/linkDecoration'
import { findActiveHeadingAnchor } from './editor/outline'
import { computeStats } from './editor/wordCount'
import { CommandPalette } from './components/CommandPalette'
import { QuickOpen } from './components/QuickOpen'
import { VaultSidebar } from './components/VaultSidebar'
import { GlobalSearch } from './components/GlobalSearch'
import { GoToLine } from './components/GoToLine'
import { Minimap, type MinimapScrollMetrics } from './components/Minimap'
import type {
  CommandPaletteAction,
  RegisteredCommandPaletteAction,
} from './components/commandPaletteRegistry'
import { serializeMarkdownSelectionForClipboard } from './editor/clipboard'
import { areCollapsedRangesEqual } from './editor/foldingState'
import { createExternalLinkBadgePlugin } from './plugins/externalLinkBadgePlugin'
import {
  MarkFlowPluginHost,
  type MarkFlowAppearance,
  type MarkFlowAppearancePreference,
  type MarkFlowDesktopAPI,
  type MarkFlowQuickOpenItem,
  type MarkFlowDocument,
  type MarkFlowFilePayload,
  type MarkFlowFileLoadProgressPayload,
  type MarkFlowImageUploadSettings,
  type MarkFlowLargeFileWindow,
  type MarkFlowMenuActionPayload,
  type MarkFlowRecoveryCheckpoint,
  type MarkFlowSpellCheckState,
  type MarkFlowTabCloseAction,
  type MarkFlowThemeState,
  type MarkFlowThemeSummary,
  type ViewMode,
  type MarkFlowWindowState,
  type MarkFlowWindowSessionState,
  type SearchResult,
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
  formatMarkdownModeStatus,
  loadLocalMarkdownModePreference,
  persistLocalMarkdownModePreference,
  type MarkFlowMarkdownMode,
} from './markdownMode'

const THEME_STYLE_ELEMENT_ID = 'mf-theme-overrides'
const EDITOR_ROOT_SELECTOR = '.cm-editor'

function formatLoadingBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}

const INITIAL_CONTENT = `# Welcome to MarkFlow

*Write in flow, publish anywhere.*

## Features

- **WYSIWYG editing** — markdown syntax hides when you move your cursor away
- *Italic*, **bold**, and \`inline code\` rendered inline
- [Links](https://example.com) displayed as clickable text

## Getting Started

Start typing here! Try writing some markdown and watch it render in real time.

### Code Example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

### A Quote

> The best way to predict the future is to invent it.
> — Alan Kay

### Task List

- [x] Set up CodeMirror 6
- [x] Implement inline decorations
- [ ] Add export support
- [x] Build plugin system

---

## Math — KaTeX

Inline math: $E = mc^2$ and $\\pi \\approx 3.14159$.

Display math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid Diagram

\`\`\`mermaid
graph TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Great!]
  B -->|No| D[Debug]
  D --> B
\`\`\`

## Table

| Feature   | Status  | Priority |
|-----------|---------|----------|
| Math      | ✅ Done  | High     |
| Mermaid   | ✅ Done  | High     |
| Tables    | ✅ Done  | Medium   |
| Export    | Partial | Low      |

## Image

![MarkFlow placeholder](https://via.placeholder.com/400x120?text=MarkFlow+Image+Test)

## Footnote

This has a footnote[^1] and another[^2].

[^1]: First footnote — rendered correctly.
[^2]: Second footnote — also rendered.

---

Happy writing!
`

function getLineNumberAtPosition(content: string, position: number) {
  const boundedPosition = Math.max(0, Math.min(position, content.length))
  let lineNumber = 1

  for (let index = 0; index < boundedPosition; index += 1) {
    if (content.charCodeAt(index) === 10) {
      lineNumber += 1
    }
  }

  return lineNumber
}

function formatAppearanceLabel(appearance: MarkFlowAppearance) {
  return appearance === 'dark' ? 'Dark' : 'Light'
}

function formatSpellCheckLanguageLabel(language: string | null) {
  return language ?? 'Default'
}

function formatHeadingNumberingStatus(enabled: boolean) {
  return enabled ? 'Headings: 1.2' : 'Headings: Plain'
}

function formatSourceLineNumbersStatus(enabled: boolean) {
  return enabled ? 'Source lines: On' : 'Source lines: Off'
}

function formatReadingTime(minutes: number, suffix: 'panel' | 'statusbar' = 'panel') {
  const label = `${minutes.toLocaleString()} min`
  return suffix === 'statusbar' ? `${label} read` : label
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

function formatImageUploadStatus(settings: MarkFlowImageUploadSettings | null) {
  if (!settings || !settings.autoUploadOnInsert || settings.uploaderKind === 'disabled') {
    return 'Uploads: Off'
  }

  return settings.uploaderKind === 'picgo-core' ? 'Uploads: PicGo' : 'Uploads: Custom'
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

function getLineStartPosition(content: string, requestedLineNumber: number) {
  const totalLines = content.length === 0 ? 1 : content.split('\n').length
  const clampedLineNumber = Math.max(1, Math.min(requestedLineNumber, totalLines))

  if (clampedLineNumber === 1) {
    return 0
  }

  let currentLine = 1
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      currentLine += 1
      if (currentLine === clampedLineNumber) {
        return index + 1
      }
    }
  }

  return content.length
}

function getLineColumnPosition(content: string, lineNumber: number, column: number) {
  const lineStart = getLineStartPosition(content, lineNumber)
  const boundedColumn = Math.max(0, column)
  const lineEndIndex = content.indexOf('\n', lineStart)
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length
  return Math.min(lineStart + boundedColumn, lineEnd)
}

let tabIdCounter = 0
let untitledTabCounter = 0

interface DocumentTabState extends MarkFlowDocument {
  id: string
  recoveryTabId: string | null
  largeFile: MarkFlowLargeFileWindow | null
  persistedContent: string
  collapsedRanges: number[]
  cursorPosition: number
  viewportPosition: number | null
  selectionText: string
  symbolTable: SymbolTable
  snapshot: MarkFlowEditorSnapshot | null
  untitledLabel: string
}

interface ClosedDocumentTabState {
  closedIndex: number
  tab: DocumentTabState
}

interface AppStartupState {
  document: MarkFlowFilePayload | null
  folderPath: string | null
  windowSession: {
    documents: MarkFlowFilePayload[]
    activeFilePath: string | null
  } | null
}

type MarkFlowStartupAPI = MarkFlowDesktopAPI & {
  getStartupState: () => Promise<AppStartupState>
}

type PendingNavigationTarget = NavigationLocation & {
  preserveScroll?: boolean
}

function createTabId() {
  tabIdCounter += 1
  return `tab-${tabIdCounter}`
}

function createUntitledLabel(content: string) {
  if (content === INITIAL_CONTENT) {
    return 'Starter Document'
  }

  untitledTabCounter += 1
  return untitledTabCounter === 1 ? 'Untitled' : `Untitled ${untitledTabCounter}`
}

function createDocumentTab(
  filePath: string | null,
  content: string,
  largeFile: MarkFlowLargeFileWindow | null = null,
): DocumentTabState {
  return {
    id: createTabId(),
    recoveryTabId: null,
    largeFile,
    filePath,
    content,
    persistedContent: content,
    isDirty: false,
    collapsedRanges: [],
    cursorPosition: 0,
    viewportPosition: null,
    selectionText: '',
    symbolTable: createEmptySymbolTable(),
    snapshot: null,
    untitledLabel: createUntitledLabel(content),
  }
}

function getTotalLinesForTab(tab: DocumentTabState | null) {
  if (!tab) {
    return 1
  }

  return tab.largeFile?.totalLines ?? (tab.content.length ? tab.content.split('\n').length : 1)
}

function getCurrentLineNumberForTab(tab: DocumentTabState | null) {
  if (!tab) {
    return 1
  }

  const localLineNumber = getLineNumberAtPosition(tab.content, tab.cursorPosition)
  if (!tab.largeFile) {
    return localLineNumber
  }

  return Math.min(
    tab.largeFile.totalLines,
    tab.largeFile.windowStartLine + localLineNumber - 1,
  )
}

function getTabLabel(tab: DocumentTabState, loadingFile: MarkFlowFileLoadProgressPayload | null = null) {
  if (tab.filePath) {
    return tab.filePath.split(/[\\/]/).at(-1) ?? tab.filePath
  }

  if (loadingFile?.filePath) {
    return loadingFile.filePath.split(/[\\/]/).at(-1) ?? loadingFile.filePath
  }

  return tab.untitledLabel
}

function findTabIndex(tabs: readonly DocumentTabState[], tabId: string | null) {
  return tabs.findIndex((tab) => tab.id === tabId)
}

function buildWindowSessionState(
  tabs: readonly DocumentTabState[],
  activeTabId: string | null,
): MarkFlowWindowSessionState {
  const filePaths = tabs.flatMap((tab) => (tab.filePath ? [tab.filePath] : []))
  const activeFilePath = tabs.find((tab) => tab.id === activeTabId)?.filePath ?? null
  return {
    filePaths,
    activeFilePath,
  }
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
  const [isDocumentStatisticsOpen, setIsDocumentStatisticsOpen] = useState(false)
  const [isMarkdownModeSettingsOpen, setIsMarkdownModeSettingsOpen] = useState(false)
  const [isSpellCheckSettingsOpen, setIsSpellCheckSettingsOpen] = useState(false)
  const [isHeadingNumberingSettingsOpen, setIsHeadingNumberingSettingsOpen] = useState(false)
  const [isSourceLineNumbersSettingsOpen, setIsSourceLineNumbersSettingsOpen] = useState(false)
  const [spellCheckWordInput, setSpellCheckWordInput] = useState('')
  const [imageUploadSettings, setImageUploadSettings] = useState<MarkFlowImageUploadSettings | null>(null)
  const [isImageUploadSettingsOpen, setIsImageUploadSettingsOpen] = useState(false)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false)
  const [themes, setThemes] = useState<MarkFlowThemeSummary[]>([])
  const [themeState, setThemeState] = useState<MarkFlowThemeState | null>(null)
  const [toasts, setToasts] = useState<AppToast[]>([])
  const [editorNavigationRequest, setEditorNavigationRequest] = useState<{
    key: number
    position: number
    scrollTop?: number | null
  } | null>(null)
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<PendingNavigationTarget | null>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [quickOpenItems, setQuickOpenItems] = useState<MarkFlowQuickOpenItem[]>([])
  const [tabs, setTabs] = useState<DocumentTabState[]>(() => [createDocumentTab(null, INITIAL_CONTENT)])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [closedTabs, setClosedTabs] = useState<ClosedDocumentTabState[]>([])
  const [loadingFile, setLoadingFile] = useState<MarkFlowFileLoadProgressPayload | null>(null)
  const [editorScrollMetrics, setEditorScrollMetrics] = useState<MinimapScrollMetrics | null>(null)
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
  const editorNavigationKeyRef = useRef(0)
  const navigationHistoryRef = useRef(createEmptyNavigationHistory())
  const pluginHostRef = useRef<MarkFlowPluginHost | null>(null)
  const editorRef = useRef<MarkFlowEditorHandle | null>(null)
  const editorShellRef = useRef<HTMLDivElement | null>(null)
  const documentStatisticsButtonRef = useRef<HTMLButtonElement | null>(null)
  const documentStatisticsPanelRef = useRef<HTMLDivElement | null>(null)
  const markdownModeButtonRef = useRef<HTMLButtonElement | null>(null)
  const markdownModePanelRef = useRef<HTMLDivElement | null>(null)
  const headingNumberingButtonRef = useRef<HTMLButtonElement | null>(null)
  const headingNumberingPanelRef = useRef<HTMLDivElement | null>(null)
  const sourceLineNumbersButtonRef = useRef<HTMLButtonElement | null>(null)
  const sourceLineNumbersPanelRef = useRef<HTMLDivElement | null>(null)
  const spellCheckButtonRef = useRef<HTMLButtonElement | null>(null)
  const spellCheckPanelRef = useRef<HTMLDivElement | null>(null)
  const imageUploadButtonRef = useRef<HTMLButtonElement | null>(null)
  const imageUploadPanelRef = useRef<HTMLDivElement | null>(null)
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

  const closeStatusbarPanels = useCallback(() => {
    setIsDocumentStatisticsOpen(false)
    setIsMarkdownModeSettingsOpen(false)
    setIsHeadingNumberingSettingsOpen(false)
    setIsSourceLineNumbersSettingsOpen(false)
    setIsSpellCheckSettingsOpen(false)
    setIsImageUploadSettingsOpen(false)
  }, [])

  const toggleDocumentStatistics = useCallback(() => {
    setIsMarkdownModeSettingsOpen(false)
    setIsHeadingNumberingSettingsOpen(false)
    setIsSourceLineNumbersSettingsOpen(false)
    setIsSpellCheckSettingsOpen(false)
    setIsImageUploadSettingsOpen(false)
    setIsDocumentStatisticsOpen((current) => !current)
    return true
  }, [])

  const activeTab = useMemo(() => {
    const byId = tabs.find((tab) => tab.id === activeTabId)
    return byId ?? tabs[0] ?? null
  }, [activeTabId, tabs])

  const replaceTabs = useCallback((nextTabs: DocumentTabState[]) => {
    tabsRef.current = nextTabs
    setTabs(nextTabs)
    return nextTabs
  }, [])

  const updateTabs = useCallback((updater: (currentTabs: DocumentTabState[]) => DocumentTabState[]) => {
    const nextTabs = updater(tabsRef.current)
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

  const updateTab = useCallback((tabId: string, updater: (tab: DocumentTabState) => DocumentTabState) => {
    updateTabs((currentTabs) =>
      currentTabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
    )
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

  const captureActiveTabSnapshot = useCallback(() => {
    const currentActiveTabId = activeTabIdRef.current
    const snapshot = editorRef.current?.captureSnapshot()
    if (!currentActiveTabId || !snapshot) {
      return null
    }

    updateTab(currentActiveTabId, (tab) => ({
      ...tab,
      snapshot,
      collapsedRanges: areCollapsedRangesEqual(tab.collapsedRanges, snapshot.collapsedRanges)
        ? tab.collapsedRanges
        : [...snapshot.collapsedRanges],
    }))
    return snapshot
  }, [updateTab])

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

  useEffect(() => {
    if (
      !isDocumentStatisticsOpen &&
      !isMarkdownModeSettingsOpen &&
      !isHeadingNumberingSettingsOpen &&
      !isSourceLineNumbersSettingsOpen &&
      !isSpellCheckSettingsOpen &&
      !isImageUploadSettingsOpen
    ) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        (target instanceof Node && documentStatisticsPanelRef.current?.contains(target)) ||
        (target instanceof Node && documentStatisticsButtonRef.current?.contains(target)) ||
        (target instanceof Node && markdownModePanelRef.current?.contains(target)) ||
        (target instanceof Node && markdownModeButtonRef.current?.contains(target)) ||
        (target instanceof Node && headingNumberingPanelRef.current?.contains(target)) ||
        (target instanceof Node && headingNumberingButtonRef.current?.contains(target)) ||
        (target instanceof Node && sourceLineNumbersPanelRef.current?.contains(target)) ||
        (target instanceof Node && sourceLineNumbersButtonRef.current?.contains(target)) ||
        (target instanceof Node && spellCheckPanelRef.current?.contains(target)) ||
        (target instanceof Node && spellCheckButtonRef.current?.contains(target)) ||
        (target instanceof Node && imageUploadPanelRef.current?.contains(target)) ||
        (target instanceof Node && imageUploadButtonRef.current?.contains(target))
      ) {
        return
      }

      closeStatusbarPanels()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStatusbarPanels()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    closeStatusbarPanels,
    isDocumentStatisticsOpen,
    isMarkdownModeSettingsOpen,
    isHeadingNumberingSettingsOpen,
    isImageUploadSettingsOpen,
    isSourceLineNumbersSettingsOpen,
    isSpellCheckSettingsOpen,
  ])

  const isImmersiveMode = windowState.isFullscreen || isDistractionFreeMode

  function applyThemeState(nextThemeState: MarkFlowThemeState | null) {
    const existing = document.getElementById(THEME_STYLE_ELEMENT_ID) as HTMLStyleElement | null
    const style = existing ?? document.createElement('style')

    if (!existing) {
      style.id = THEME_STYLE_ELEMENT_ID
      document.head.appendChild(style)
    }

    style.textContent = nextThemeState?.activeTheme?.cssText ?? ''
    setThemeState(nextThemeState)
  }

  useEffect(() => {
    const api = window.markflow
    if (!api) return

    const applyOpenedDocument = async ({ filePath, content, largeFile }: MarkFlowFilePayload) => {
      captureActiveTabSnapshot()
      setLoadingFile((current) => (current?.filePath === filePath ? null : current))
      setEditorNavigationRequest(null)
      setIsGoToLineOpen(false)

      const currentTabs = tabsRef.current
      let nextTabs = currentTabs
      let nextActiveId: string | null = null
      let filePathToLoad: string | null = null
      if (filePath) {
        const existingTab = currentTabs.find((tab) => tab.filePath === filePath)
        if (existingTab) {
          nextActiveId = existingTab.id
          if (existingTab.content !== content) {
            filePathToLoad = largeFile ? null : filePath
            nextTabs = currentTabs.map((tab) =>
              tab.id === existingTab.id
                ? {
                    ...tab,
                    recoveryTabId: null,
                    largeFile: largeFile ?? null,
                    content,
                    persistedContent: content,
                    isDirty: false,
                    collapsedRanges: [],
                    cursorPosition: 0,
                    viewportPosition: null,
                    selectionText: '',
                    symbolTable: createEmptySymbolTable(),
                    snapshot: null,
                  }
                : tab,
            )
          }
        }
      }

      if (nextActiveId == null) {
        const nextTab = createDocumentTab(filePath, content, largeFile ?? null)
        nextActiveId = nextTab.id
        filePathToLoad = largeFile ? null : filePath
        nextTabs =
          currentTabs.length === 1 &&
          currentTabs[0].filePath == null &&
          !currentTabs[0].isDirty &&
          (currentTabs[0].content === INITIAL_CONTENT || currentTabs[0].content === '')
            ? [nextTab]
            : [...currentTabs, nextTab]
      }

      replaceTabs(nextTabs)

      if (nextActiveId) {
        replaceActiveTabId(nextActiveId)
      }
      if (nextActiveId && filePathToLoad) {
        await loadCollapsedRangesForTab(api, nextActiveId, filePathToLoad)
      }
    }

    const applyRecoveredDocuments = async (
      checkpoint: MarkFlowRecoveryCheckpoint,
      persistedDocuments: readonly MarkFlowFilePayload[],
    ) => {
      captureActiveTabSnapshot()
      setLoadingFile(null)
      setEditorNavigationRequest(null)
      setIsGoToLineOpen(false)

      let nextTabs = tabsRef.current
      let nextActiveId: string | null = null
      const fileLoads: Array<{ filePath: string; tabId: string }> = []

      for (const recoveredDocument of checkpoint.documents) {
        const persistedContent =
          recoveredDocument.filePath
            ? persistedDocuments.find((document) => document.filePath === recoveredDocument.filePath)?.content ?? ''
            : ''
        const existingTab = recoveredDocument.filePath
          ? nextTabs.find((tab) => tab.filePath === recoveredDocument.filePath)
          : null

        if (existingTab) {
          nextTabs = nextTabs.map((tab) =>
            tab.id === existingTab.id
              ? {
                  ...tab,
                  recoveryTabId: recoveredDocument.tabId,
                  content: recoveredDocument.content,
                  persistedContent,
                  isDirty: recoveredDocument.content !== persistedContent,
                  cursorPosition: 0,
                  viewportPosition: null,
                  selectionText: '',
                  symbolTable: createEmptySymbolTable(),
                  snapshot: null,
                }
              : tab,
          )
          if (recoveredDocument.filePath) {
            fileLoads.push({ filePath: recoveredDocument.filePath, tabId: existingTab.id })
          }
          if (checkpoint.activeTabId === recoveredDocument.tabId) {
            nextActiveId = existingTab.id
          }
          continue
        }

        const recoveredTab: DocumentTabState = {
          ...createDocumentTab(recoveredDocument.filePath, recoveredDocument.content),
          recoveryTabId: recoveredDocument.tabId,
          persistedContent,
          isDirty: recoveredDocument.content !== persistedContent,
        }
        nextTabs = [...nextTabs, recoveredTab]
        if (recoveredDocument.filePath) {
          fileLoads.push({ filePath: recoveredDocument.filePath, tabId: recoveredTab.id })
        }
        if (checkpoint.activeTabId === recoveredDocument.tabId) {
          nextActiveId = recoveredTab.id
        }
      }

      replaceTabs(nextTabs)
      replaceActiveTabId(nextActiveId ?? activeTabIdRef.current ?? nextTabs[0]?.id ?? null)

      await Promise.all(
        fileLoads.map(({ filePath, tabId }) => loadCollapsedRangesForTab(api, tabId, filePath)),
      )
    }

    const handleMenuAction = async ({ action, path }: MarkFlowMenuActionPayload) => {
      switch (action) {
        case 'new-file':
          await api.newFile()
          break
        case 'open-file':
          await api.openFile()
          break
        case 'open-recent-folder':
          if (path) {
            await handleOpenFolderPathRef.current(path)
          }
          break
        case 'save-file':
          await handleSaveTabRef.current(activeTabIdRef.current)
          break
        case 'save-file-as':
          await handleSaveTabRef.current(activeTabIdRef.current, true)
          break
        case 'close-tab':
          await handleCloseTabRef.current(activeTabIdRef.current)
          break
        case 'reopen-closed-tab':
          await handleReopenClosedTabRef.current()
          break
        case 'next-tab':
          handleCycleTabsRef.current(1)
          break
        case 'previous-tab':
          handleCycleTabsRef.current(-1)
          break
        case 'toggle-minimap':
          setShowMinimap((current) => !current)
          break
        case 'toggle-sidebar':
          setShowSidebar((current) => !current)
          break
        case 'toggle-outline':
          setOutlineCollapsed((current) => !current)
          break
        case 'toggle-document-statistics':
          toggleDocumentStatistics()
          break
        case 'toggle-distraction-free':
          toggleDistractionFreeMode()
          break
        case 'toggle-focus-mode':
          toggleFocusMode()
          break
        case 'toggle-typewriter-mode':
          toggleTypewriterMode()
          break
        case 'clear-formatting':
          editorRef.current?.executeCommand('edit-clear-formatting')
          break
        case 'copy':
        case 'copy-as-markdown':
        case 'copy-as-html-code':
          await handleCopyActionRef.current(action)
          break
        case 'export-html':
          await handleExportRef.current('html')
          break
        case 'export-pdf':
          await handleExportRef.current('pdf')
          break
        case 'export-docx':
        case 'export-epub':
        case 'export-latex':
          await handlePandocExportRef.current(action)
          break
        case 'go-to-line':
          setIsGoToLineOpen(true)
          break
        case 'navigate-back':
          await handleNavigateBackRef.current()
          break
        case 'navigate-forward':
          await handleNavigateForwardRef.current()
          break
        case 'command-palette':
          setIsCommandPaletteOpen(true)
          break
        case 'quick-open':
          await handleOpenQuickOpenRef.current()
          break
        case 'global-search':
          setIsGlobalSearchOpen(true)
          break
        case 'format-bold':
          editorRef.current?.executeCommand('edit-bold')
          break
        case 'format-italic':
          editorRef.current?.executeCommand('edit-italic')
          break
        case 'format-strikethrough':
          editorRef.current?.executeCommand('edit-strikethrough')
          break
        case 'format-code':
          editorRef.current?.executeCommand('edit-inline-code')
          break
        case 'format-link':
          editorRef.current?.executeCommand('edit-link')
          break
        case 'format-heading-1':
          editorRef.current?.executeCommand('edit-heading-1')
          break
        case 'format-heading-2':
          editorRef.current?.executeCommand('edit-heading-2')
          break
        case 'format-heading-3':
          editorRef.current?.executeCommand('edit-heading-3')
          break
        case 'insert-image':
          editorRef.current?.executeCommand('insert-image')
          break
        case 'insert-table':
          editorRef.current?.executeCommand('insert-table')
          break
        case 'insert-hr':
          editorRef.current?.executeCommand('insert-hr')
          break
        case 'insert-code-block':
          editorRef.current?.executeCommand('insert-code-fence')
          break
        case 'insert-math':
          editorRef.current?.executeCommand('insert-math-block')
          break
        case 'insert-blockquote':
          editorRef.current?.executeCommand('insert-blockquote')
          break
        case 'insert-task-list':
          editorRef.current?.executeCommand('insert-task-list')
          break
      }
    }

    const unsubscribeFileOpened = api.onFileOpened((payload) => {
      void applyOpenedDocument(payload)
    })
    const unsubscribeFileLoadingProgress = api.onFileLoadingProgress((payload) => {
      setLoadingFile(payload)
    })
    const unsubscribeFileSaved = api.onFileSaved(({ filePath }) => {
      updateTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id !== activeTabIdRef.current && tab.filePath !== filePath) {
            return tab
          }

          return {
            ...tab,
            filePath,
            persistedContent: tab.content,
            isDirty: false,
          }
        }),
      )
    })
    const unsubscribeMenuAction = api.onMenuAction((payload) => {
      void handleMenuAction(payload)
    })
    const unsubscribeWindowStateChanged = api.onWindowStateChanged((nextWindowState) => {
      setWindowState(nextWindowState)
    })
    const unsubscribeThemeUpdated = api.onThemeUpdated(applyThemeState)

    void (async () => {
      let persistedDocuments: MarkFlowFilePayload[] = []
      const startupState = await api.getStartupState()
      if (startupState.windowSession?.documents.length) {
        const nextTabs = startupState.windowSession.documents.map((document) =>
          createDocumentTab(document.filePath, document.content, document.largeFile ?? null),
        )
        const nextActiveTab =
          nextTabs.find((tab) => tab.filePath === startupState.windowSession?.activeFilePath) ??
          nextTabs[0] ??
          null

        replaceTabs(nextTabs)
        replaceActiveTabId(nextActiveTab?.id ?? null)
        persistedDocuments = startupState.windowSession.documents
        await Promise.all(
          nextTabs.map((tab) =>
            tab.largeFile ? Promise.resolve() : loadCollapsedRangesForTab(api, tab.id, tab.filePath),
          ),
        )
      } else if (startupState.document) {
        persistedDocuments = [startupState.document]
        await applyOpenedDocument(startupState.document)
      }

      if (startupState.folderPath) {
        setVaultPath(startupState.folderPath)
        setShowSidebar(true)
        const files = await api.getVaultFiles(startupState.folderPath)
        setVaultFiles(files ?? [])
      }

      const recoveryCheckpoint = await api.getRecoveryCheckpoint()
      if (!recoveryCheckpoint) {
        return
      }

      const activeRecoveryDocument =
        recoveryCheckpoint.documents.find((document) => document.tabId === recoveryCheckpoint.activeTabId) ??
        recoveryCheckpoint.documents[0]
      const recoveredName =
        recoveryCheckpoint.documents.length === 1
          ? activeRecoveryDocument?.filePath?.split(/[\\/]/).at(-1) ?? 'untitled document'
          : `${recoveryCheckpoint.documents.length} documents`
      const shouldRecover = window.confirm(
        `Recover the auto-saved changes for ${recoveredName} from ${new Date(recoveryCheckpoint.savedAt).toLocaleString()}?`,
      )

      if (!shouldRecover) {
        await api.discardRecoveryCheckpoint()
        return
      }

      await applyRecoveredDocuments(recoveryCheckpoint, persistedDocuments)
    })()
    void api.getWindowState().then((nextWindowState) => {
      setWindowState(nextWindowState)
    })
    void api.getThemes().then(setThemes)
    void api.getThemeState().then((nextThemeState) => {
      applyThemeState(nextThemeState)
    })

    return () => {
      unsubscribeFileOpened()
      unsubscribeFileLoadingProgress()
      unsubscribeFileSaved()
      unsubscribeMenuAction()
      unsubscribeWindowStateChanged()
      unsubscribeThemeUpdated()
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove()
    }
  }, [
    captureActiveTabSnapshot,
    loadCollapsedRangesForTab,
    replaceActiveTabId,
    replaceTabs,
    toggleDocumentStatistics,
    updateTabs,
  ])

  function toggleViewMode() {
    setViewMode((m) => (m === 'wysiwyg' ? 'source' : 'wysiwyg'))
  }

  function toggleFocusMode() {
    setFocusMode((v) => !v)
  }

  function toggleTypewriterMode() {
    setTypewriterMode((v) => !v)
  }

  function toggleDistractionFreeMode() {
    setIsDistractionFreeMode((v) => !v)
  }

  useEffect(() => {
    if (!isImmersiveMode) {
      return
    }

    closeStatusbarPanels()
  }, [closeStatusbarPanels, isImmersiveMode])

  useEffect(() => {
    setEditorScrollMetrics(null)
  }, [activeTab?.id])

  const handleOpenCommandPalette = useCallback(() => {
    setIsQuickOpenOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(false)
    setIsCommandPaletteOpen(true)
  }, [])

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

  const createNavigationLocationForTab = useCallback(
    (
      tab: DocumentTabState,
      overrides: Partial<PendingNavigationTarget> = {},
    ): PendingNavigationTarget => ({
      tabId: overrides.tabId ?? tab.id,
      filePath: overrides.filePath ?? tab.filePath,
      cursorPosition:
        overrides.cursorPosition ??
        tab.snapshot?.cursorPosition ??
        tab.cursorPosition,
      scrollTop:
        overrides.scrollTop ??
        tab.snapshot?.scrollTop ??
        null,
      preserveScroll: overrides.preserveScroll ?? false,
    }),
    [],
  )

  const captureActiveNavigationLocation = useCallback((): NavigationLocation | null => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return null
    }

    const snapshot = captureActiveTabSnapshot()
    const currentTab = tabsRef.current.find((tab) => tab.id === currentActiveTabId)
    if (!currentTab) {
      return null
    }

    return {
      tabId: currentTab.id,
      filePath: currentTab.filePath,
      cursorPosition: snapshot?.cursorPosition ?? currentTab.snapshot?.cursorPosition ?? currentTab.cursorPosition,
      scrollTop: snapshot?.scrollTop ?? currentTab.snapshot?.scrollTop ?? null,
    }
  }, [captureActiveTabSnapshot])

  const requestEditorNavigation = useCallback((target: PendingNavigationTarget) => {
    const targetTabId = target.tabId ?? activeTabIdRef.current
    if (!targetTabId) {
      return
    }

    updateTab(targetTabId, (tab) => ({
      ...tab,
      cursorPosition: target.cursorPosition,
      viewportPosition: null,
    }))

    editorNavigationKeyRef.current += 1
    setEditorNavigationRequest({
      key: editorNavigationKeyRef.current,
      position: target.cursorPosition,
      scrollTop: target.preserveScroll ? target.scrollTop : null,
    })
  }, [updateTab])

  useEffect(() => {
    if (!pendingNavigationTarget || !activeTab) {
      return
    }

    const matchesTarget =
      (pendingNavigationTarget.tabId != null && activeTab.id === pendingNavigationTarget.tabId) ||
      (pendingNavigationTarget.filePath != null && activeTab.filePath === pendingNavigationTarget.filePath)

    if (!matchesTarget) {
      return
    }

    requestEditorNavigation({
      ...pendingNavigationTarget,
      tabId: activeTab.id,
    })
    setPendingNavigationTarget(null)
  }, [activeTab, pendingNavigationTarget, requestEditorNavigation])

  const openPathWithOptionalHistory = useCallback(
    async (
      filePath: string,
      options: {
        destination?: PendingNavigationTarget | null
        missingMessage?: string
        pushHistory?: boolean
      } = {},
    ) => {
      const currentLocation = options.pushHistory ? captureActiveNavigationLocation() : null
      const sourceFilePath =
        activeTabIdRef.current != null
          ? tabsRef.current.find((tab) => tab.id === activeTabIdRef.current)?.filePath ?? null
          : null
      const resolvedFilePath = fileUrlToPath(resolveLinkHref(filePath, sourceFilePath ?? undefined)) ?? filePath
      const existingTab = tabsRef.current.find((tab) => tab.filePath === resolvedFilePath) ?? null

      if (existingTab) {
        if (!options.pushHistory) {
          captureActiveTabSnapshot()
        }

        const destination = options.destination ?? createNavigationLocationForTab(existingTab)

        if (currentLocation) {
          navigationHistoryRef.current = pushNavigationHistoryEntry(
            navigationHistoryRef.current,
            currentLocation,
            destination,
          )
        }

        setPendingNavigationTarget(destination)
        if (activeTabIdRef.current !== existingTab.id) {
          replaceActiveTabId(existingTab.id)
        }
        return destination
      }

      const result = await window.markflow?.openPath(resolvedFilePath)
      if (!result) {
        showToast(options.missingMessage ?? 'That recent file is no longer available.')
        setPendingNavigationTarget(null)
        return null
      }

      const destination =
        options.destination ??
        ({
          tabId: null,
          filePath: resolvedFilePath,
          cursorPosition: 0,
          scrollTop: 0,
          preserveScroll: true,
        } satisfies PendingNavigationTarget)

      if (currentLocation) {
        navigationHistoryRef.current = pushNavigationHistoryEntry(
          navigationHistoryRef.current,
          currentLocation,
          destination,
        )
      }

      setPendingNavigationTarget(destination)
      return destination
    },
    [
      captureActiveTabSnapshot,
      captureActiveNavigationLocation,
      createNavigationLocationForTab,
      replaceActiveTabId,
      showToast,
    ],
  )

  const restoreNavigationTarget = useCallback(
    async (target: PendingNavigationTarget | null) => {
      if (!target) {
        return false
      }

      if (target.filePath == null) {
        const untitledTab = tabsRef.current.find((tab) => tab.id === target.tabId) ?? null
        if (!untitledTab) {
          return false
        }

        setPendingNavigationTarget({
          ...target,
          tabId: untitledTab.id,
        })
        if (activeTabIdRef.current !== untitledTab.id) {
          replaceActiveTabId(untitledTab.id)
        }
        return true
      }

      const existingTab = tabsRef.current.find(
        (tab) => tab.id === target.tabId || tab.filePath === target.filePath,
      ) ?? null

      if (existingTab) {
        setPendingNavigationTarget({
          ...target,
          tabId: existingTab.id,
        })
        if (activeTabIdRef.current !== existingTab.id) {
          replaceActiveTabId(existingTab.id)
        }
        return true
      }

      const result = await window.markflow?.openPath(target.filePath)
      if (!result) {
        showToast('That recent file is no longer available.')
        setPendingNavigationTarget(null)
        return false
      }

      setPendingNavigationTarget(target)
      return true
    },
    [replaceActiveTabId, showToast],
  )

  const handleNavigateBack = useCallback(async () => {
    if (!canNavigateBack(navigationHistoryRef.current)) {
      return false
    }

    const currentLocation = captureActiveNavigationLocation()
    if (!currentLocation) {
      return false
    }

    const { history, target } = navigateBackInHistory(navigationHistoryRef.current, currentLocation)
    if (!target) {
      navigationHistoryRef.current = history
      return false
    }

    const didRestore = await restoreNavigationTarget({
      ...target,
      preserveScroll: target.scrollTop != null,
    })
    navigationHistoryRef.current = didRestore
      ? history
      : {
          entries: history.entries,
          currentIndex: history.currentIndex + 1,
        }
    return didRestore
  }, [captureActiveNavigationLocation, restoreNavigationTarget])

  const handleNavigateForward = useCallback(async () => {
    if (!canNavigateForward(navigationHistoryRef.current)) {
      return false
    }

    const currentLocation = captureActiveNavigationLocation()
    if (!currentLocation) {
      return false
    }

    const { history, target } = navigateForwardInHistory(navigationHistoryRef.current, currentLocation)
    if (!target) {
      navigationHistoryRef.current = history
      return false
    }

    const didRestore = await restoreNavigationTarget({
      ...target,
      preserveScroll: target.scrollTop != null,
    })
    navigationHistoryRef.current = didRestore
      ? history
      : {
          entries: history.entries,
          currentIndex: history.currentIndex - 1,
        }
    return didRestore
  }, [captureActiveNavigationLocation, restoreNavigationTarget])

  const handleOpenQuickOpen = useCallback(async () => {
    const api = window.markflow
    if (!api) {
      return false
    }

    const items = await api.getQuickOpenList()
    setQuickOpenItems(items)
    setIsCommandPaletteOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(false)
    setIsQuickOpenOpen(true)
    return true
  }, [])

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
      return true
    },
    [showToast],
  )

  const handleOpenGlobalSearch = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGoToLineOpen(false)
    setIsGlobalSearchOpen(true)
    return true
  }, [])

  const handleToggleGlobalSearch = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGoToLineOpen(false)
    setIsGlobalSearchOpen((current) => !current)
    return true
  }, [])

  const handleOpenGoToLine = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(true)
    return true
  }, [])

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

  const handleGlobalSearchResult = useCallback(async (result: SearchResult) => {
    setIsGlobalSearchOpen(false)

    const existingTab = tabsRef.current.find((tab) => tab.filePath === result.filePath) ?? null
    if (existingTab) {
      const destination = createNavigationLocationForTab(existingTab, {
        cursorPosition: getLineColumnPosition(existingTab.content, result.lineNumber, result.matchStart),
        scrollTop: null,
        preserveScroll: false,
      })
      await openPathWithOptionalHistory(result.filePath, {
        destination,
        missingMessage: 'That recent file is no longer available.',
        pushHistory: true,
      })
      return
    }

    const currentLocation = captureActiveNavigationLocation()
    const payload = await window.markflow?.openPath(result.filePath)
    if (!payload) {
      showToast('That recent file is no longer available.')
      return
    }

    const destination: PendingNavigationTarget = {
      tabId: null,
      filePath: result.filePath,
      cursorPosition: getLineColumnPosition(payload.content, result.lineNumber, result.matchStart),
      scrollTop: null,
      preserveScroll: false,
    }

    if (currentLocation) {
      navigationHistoryRef.current = pushNavigationHistoryEntry(
        navigationHistoryRef.current,
        currentLocation,
        destination,
      )
    }

    setPendingNavigationTarget(destination)
  }, [
    captureActiveNavigationLocation,
    createNavigationLocationForTab,
    openPathWithOptionalHistory,
    showToast,
  ])

  const handleSwitchTab = useCallback(
    (tabId: string | null) => {
      if (!tabId || tabId === activeTabIdRef.current) {
        return
      }

      captureActiveTabSnapshot()
      setEditorNavigationRequest(null)
      setIsGoToLineOpen(false)
      replaceActiveTabId(tabId)
    },
    [captureActiveTabSnapshot, replaceActiveTabId],
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
      if (tabId === activeTabIdRef.current) {
        latestSnapshot = editorRef.current?.captureSnapshot() ?? null
        if (latestSnapshot) {
          const nextSnapshot = latestSnapshot
          updateTab(tabId, (currentTab) => ({
            ...currentTab,
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
        ? await api.saveFileAs(tab.content, tab.recoveryTabId ?? tabId)
        : await api.saveFile(tab.content, tab.recoveryTabId ?? tabId)
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
        persistedContent: currentTab.content,
        isDirty: false,
      }))
      return true
    },
    [syncWindowSession, updateTab],
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
      setEditorNavigationRequest(null)
      setIsGoToLineOpen(false)
      return true
    },
    [handleSaveTab, loadingFile, replaceActiveTabId, replaceTabs],
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

  const totalLines = useMemo(
    () => getTotalLinesForTab(activeTab),
    [activeTab],
  )

  const currentLineNumber = useMemo(
    () => getCurrentLineNumberForTab(activeTab),
    [activeTab],
  )

  const windowSessionKey = useMemo(
    () => tabs.map((tab) => tab.filePath ?? '').join('\u0000'),
    [tabs],
  )

  const dirtyRecoveryDocuments = useMemo(
    () =>
      tabs
        .filter((tab) => tab.isDirty && tab.largeFile == null)
        .map((tab) => ({
          tabId: tab.recoveryTabId ?? tab.id,
          filePath: tab.filePath,
          content: tab.content,
        })),
    [tabs],
  )

  useEffect(() => {
    if (!activeTabId) {
      return
    }

    void syncWindowSession(tabsRef.current, activeTabId)
  }, [activeTabId, syncWindowSession, windowSessionKey])

  useEffect(() => {
    const api = window.markflow
    if (!api || dirtyRecoveryDocuments.length === 0) return

    api.scheduleRecoveryCheckpoint({
      activeTabId: activeTab?.isDirty ? activeTab.recoveryTabId ?? activeTab.id : null,
      documents: dirtyRecoveryDocuments,
    })
  }, [activeTab?.id, activeTab?.isDirty, dirtyRecoveryDocuments])

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
    handleOpenCommandPalette,
    handleOpenGoToLine,
    handleOpenQuickOpen,
    handleReopenClosedTab,
    handleToggleGlobalSearch,
  ])

  const handleQuickOpenSelect = async (item: MarkFlowQuickOpenItem) => {
    setIsQuickOpenOpen(false)
    if (item.kind === 'folder') {
      await handleOpenFolderPath(item.filePath)
      return
    }

    await handleOpenPath(item.filePath)
  }


  const handlePandocExport = async (action: 'export-docx' | 'export-epub' | 'export-latex') => {
    const api = window.markflow
    if (!api || !activeTab || activeTab.largeFile) return

    const ext = action === 'export-docx' ? 'docx' : action === 'export-epub' ? 'epub' : 'tex'
    const defaultName = activeTab.filePath
      ? activeTab.filePath.replace(/\.(md|markdown|txt)$/i, '') + '.' + ext
      : `Untitled.${ext}`

    if (action === 'export-docx') {
      await api.exportDocx(activeTab.content, defaultName)
    } else if (action === 'export-epub') {
      await api.exportEpub(activeTab.content, defaultName)
    } else {
      await api.exportLatex(activeTab.content, defaultName)
    }
  }

  const handleExport = async (format: 'html' | 'pdf') => {
    if (!activeTab || activeTab.largeFile) {
      return
    }

    setIsExporting(true)
    // Wait a couple of frames for the React state to render the unconstrained editor
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => setTimeout(r, 100)) // give CodeMirror time to settle

    const exportEl = document.getElementById('mf-export-container')
    const cmContent = exportEl?.querySelector('.cm-content')
    
    if (!cmContent) {
      setIsExporting(false)
      return
    }

    const styles = Array.from(document.querySelectorAll('style')).map(s => s.outerHTML).join('\n')
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${activeTab.filePath ? activeTab.filePath.split('/').pop() : 'Export'}</title>
  ${styles}
  <style>
    body { background-color: var(--mf-bg); color: var(--mf-text); font-family: var(--mf-font-sans); padding: 40px; margin: 0; }
    .cm-content { padding: 0 !important; }
  </style>
</head>
<body class="mf-export-body" ${HEADING_NUMBERING_ATTRIBUTE}="${headingNumberingEnabled ? 'true' : 'false'}">
  <div class="mf-editor-shell">
    <div class="mf-editor-container">
      <div class="cm-editor">
        <div class="cm-scroller">
          ${cmContent.outerHTML}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

    setIsExporting(false)

    const api = window.markflow
    if (!api) return
    
    const defaultName = activeTab.filePath
      ? activeTab.filePath.replace(/\.(md|markdown|txt)$/i, '') + '.' + format
      : 'Untitled.' + format

    if (format === 'html') {
      await api.exportHtml(html, defaultName)
    } else {
      await api.exportPdf(html, defaultName)
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
        editorRef.current?.replaceTextOccurrence(searchText, replacementText, occurrenceIndex)
      }

      updateTab(tabId, (tab) => {
        const nextContent = replaceNthOccurrence(tab.content, searchText, replacementText, occurrenceIndex)
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
    [updateTab],
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

  function handleContentChange(content: string) {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) =>
      tab.largeFile
        ? tab
        : {
            ...tab,
            content,
            isDirty: content !== tab.persistedContent,
          },
    )
  }

  function handleSelectionChange(nextSelectionText: string) {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => ({
      ...tab,
      selectionText: nextSelectionText,
    }))
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

  const handleOpenPath = useCallback(
    async (filePath: string, options: { pushHistory?: boolean } = {}) =>
      openPathWithOptionalHistory(filePath, {
        missingMessage: 'That recent file is no longer available.',
        pushHistory: options.pushHistory ?? false,
      }),
    [openPathWithOptionalHistory],
  )

  async function handleThemeChange(appearance: MarkFlowAppearance, event: ChangeEvent<HTMLSelectElement>) {
    const api = window.markflow
    const nextThemeState = await api?.setThemeForAppearance(appearance, event.target.value)
    if (!nextThemeState) {
      return
    }

    applyThemeState(nextThemeState)

    if (nextThemeState.activeAppearance !== appearance) {
      const activatedThemeState = await api?.setThemeAppearancePreference(appearance)
      if (activatedThemeState) {
        applyThemeState(activatedThemeState)
      }
    }
  }

  async function handleThemeAppearancePreferenceChange(preference: MarkFlowAppearancePreference) {
    const nextThemeState = await window.markflow?.setThemeAppearancePreference(preference)
    if (nextThemeState) {
      applyThemeState(nextThemeState)
    }
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

  const commandPaletteActions: CommandPaletteAction[] = [
    {
      id: 'view.toggle-wysiwyg',
      label: 'Toggle WYSIWYG Mode',
      category: 'View',
      description: viewMode === 'wysiwyg' ? 'Switch to source mode' : 'Switch to WYSIWYG mode',
      keywords: ['preview', 'source', 'mode'],
      shortcut: 'Mod+/',
      focusEditorAfterRun: true,
      run: () => {
        toggleViewMode()
        return true
      },
    },
    {
      id: 'view.toggle-outline',
      label: 'Toggle Outline',
      category: 'View',
      description: outlineCollapsed ? 'Expand the heading outline' : 'Collapse the heading outline',
      keywords: ['headings', 'sidebar', 'panel'],
      focusEditorAfterRun: true,
      run: () => {
        setOutlineCollapsed((current) => !current)
        return true
      },
    },
    {
      id: 'view.toggle-minimap',
      label: 'Toggle Minimap',
      category: 'View',
      description: showMinimap ? 'Hide the document minimap' : 'Show a right-side document minimap',
      keywords: ['overview', 'canvas', 'scroll map'],
      focusEditorAfterRun: true,
      run: () => {
        setShowMinimap((current) => !current)
        return true
      },
    },
    {
      id: 'view.toggle-distraction-free',
      label: 'Toggle Distraction-Free Mode',
      category: 'View',
      description: isDistractionFreeMode
        ? 'Restore chrome and side panels'
        : 'Hide chrome and side panels around the editor',
      keywords: ['immersive', 'centered', 'zen', 'chrome', 'panels'],
      focusEditorAfterRun: true,
      run: () => {
        toggleDistractionFreeMode()
        return true
      },
    },
    {
      id: 'view.toggle-focus-mode',
      label: 'Toggle Focus Mode',
      category: 'View',
      description: focusMode ? 'Leave focus mode' : 'Dim non-active paragraphs',
      keywords: ['spotlight', 'active paragraph'],
      shortcut: 'Mod+Shift+F',
      focusEditorAfterRun: true,
      run: () => {
        toggleFocusMode()
        return true
      },
    },
    {
      id: 'view.toggle-typewriter-mode',
      label: 'Toggle Typewriter Mode',
      category: 'View',
      description: typewriterMode ? 'Leave typewriter mode' : 'Keep the active line centered',
      keywords: ['centered caret', 'writing'],
      shortcut: 'Mod+Shift+T',
      focusEditorAfterRun: true,
      run: () => {
        toggleTypewriterMode()
        return true
      },
    },
    {
      id: 'view.document-statistics',
      label: 'Toggle Document Statistics',
      category: 'View',
      description: isDocumentStatisticsOpen
        ? 'Hide the detailed document statistics panel'
        : 'Show words, characters, paragraphs, and reading time',
      keywords: ['word count', 'characters', 'reading time', 'status bar', 'statistics'],
      run: () => toggleDocumentStatistics(),
    },
    {
      id: 'navigation.quick-open',
      label: 'Quick Open Files',
      category: 'Navigation',
      description: 'Browse nearby and recent markdown files',
      keywords: ['open file', 'recent', 'nearby'],
      shortcut: 'Mod+Shift+O / Ctrl+P',
      run: () => handleOpenQuickOpen(),
    },
    {
      id: 'navigation.global-search',
      label: 'Open Global Search',
      category: 'Navigation',
      description: 'Search across the current vault',
      keywords: ['find in files', 'vault search'],
      shortcut: 'Mod+Shift+F',
      run: () => handleOpenGlobalSearch(),
    },
    {
      id: 'navigation.go-to-line',
      label: 'Go to Line',
      category: 'Navigation',
      description: 'Jump directly to a line number',
      keywords: ['jump', 'line number'],
      shortcut: 'Mod+L',
      run: () => handleOpenGoToLine(),
    },
    {
      id: 'navigation.back',
      label: 'Go Back',
      category: 'Navigation',
      description: 'Return to the previous visited heading or file',
      keywords: ['history', 'back', 'previous location'],
      shortcut: 'Mod+[',
      focusEditorAfterRun: true,
      run: () => handleNavigateBack(),
    },
    {
      id: 'navigation.forward',
      label: 'Go Forward',
      category: 'Navigation',
      description: 'Move to the next visited heading or file',
      keywords: ['history', 'forward', 'next location'],
      shortcut: 'Mod+]',
      focusEditorAfterRun: true,
      run: () => handleNavigateForward(),
    },
    {
      id: 'file.new',
      label: 'New File',
      category: 'File',
      description: 'Start a blank document',
      keywords: ['document'],
      shortcut: 'Mod+N',
      run: async () => {
        const api = window.markflow
        if (!api) {
          return false
        }

        await api.newFile()
        return true
      },
    },
    {
      id: 'file.open',
      label: 'Open File',
      category: 'File',
      description: 'Choose a markdown file from disk',
      keywords: ['document'],
      shortcut: 'Mod+O',
      run: async () => {
        const api = window.markflow
        if (!api) {
          return false
        }

        await api.openFile()
        return true
      },
    },
    {
      id: 'file.save',
      label: 'Save File',
      category: 'File',
      description: 'Write the current document to disk',
      keywords: ['document', 'write'],
      shortcut: 'Mod+S',
      run: async () => {
        return handleSaveTab(activeTabIdRef.current)
      },
    },
    {
      id: 'file.save-as',
      label: 'Save File As',
      category: 'File',
      description: 'Choose a new destination for this document',
      keywords: ['document', 'rename copy'],
      shortcut: 'Mod+Shift+S',
      run: async () => {
        return handleSaveTab(activeTabIdRef.current, true)
      },
    },
    {
      id: 'file.open-folder',
      label: 'Open Folder',
      category: 'File',
      description: 'Load a vault into the file sidebar',
      keywords: ['vault', 'workspace'],
      run: async () => {
        await handleOpenFolder()
        return true
      },
    },
    {
      id: 'insert.table',
      label: 'Insert Table',
      category: 'Insert',
      description: 'Replace the current paragraph with a 2-column table scaffold',
      keywords: ['table scaffold', 'markdown table'],
      shortcut: 'Cmd+Opt+T / Ctrl+T',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('insert-table') ?? false,
    },
    {
      id: 'insert.code-fence',
      label: 'Insert Code Fence',
      category: 'Insert',
      description: 'Create a fenced code block scaffold',
      keywords: ['code block', 'triple backticks'],
      shortcut: 'Cmd+Opt+C / Ctrl+Shift+K',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('insert-code-fence') ?? false,
    },
    {
      id: 'insert.math-block',
      label: 'Insert Math Block',
      category: 'Insert',
      description: 'Create a display-math scaffold',
      keywords: ['equation', 'latex', 'katex'],
      shortcut: 'Cmd+Opt+B / Ctrl+Shift+M',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('insert-math-block') ?? false,
    },
    {
      id: 'edit.bold',
      label: 'Bold Selection',
      category: 'Edit',
      description: 'Wrap the current selection in strong emphasis',
      keywords: ['format', 'strong'],
      shortcut: 'Mod+B',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-bold') ?? false,
    },
    {
      id: 'edit.italic',
      label: 'Italic Selection',
      category: 'Edit',
      description: 'Wrap the current selection in emphasis',
      keywords: ['format', 'emphasis'],
      shortcut: 'Mod+I',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-italic') ?? false,
    },
    {
      id: 'edit.link',
      label: 'Insert Link',
      category: 'Edit',
      description: 'Insert a markdown link wrapper at the selection',
      keywords: ['hyperlink', 'url'],
      shortcut: 'Mod+K',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-link') ?? false,
    },
    {
      id: 'edit.clear-formatting',
      label: 'Clear Formatting',
      category: 'Edit',
      description: 'Strip inline markdown wrappers from the current selection',
      keywords: ['plain text', 'remove style', 'unwrap link', 'format'],
      shortcut: 'Mod+\\',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-clear-formatting') ?? false,
    },
    {
      id: 'edit.delete-word',
      label: 'Delete Word',
      category: 'Edit',
      description: 'Remove the current word without disturbing adjacent markdown',
      keywords: ['delete range', 'typora', 'word'],
      shortcut: 'Mod+Shift+D',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-delete-word') ?? false,
    },
    {
      id: 'edit.delete-line-or-sentence',
      label: 'Delete Line or Sentence',
      category: 'Edit',
      description: 'Delete the current sentence, code line, math line, or table row',
      keywords: ['delete range', 'typora', 'sentence', 'line', 'row'],
      shortcut: 'Mod+Shift+Backspace',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-delete-line-or-sentence') ?? false,
    },
    {
      id: 'edit.delete-block',
      label: 'Delete Block',
      category: 'Edit',
      description: 'Remove the current heading, paragraph block, list item, or fenced block',
      keywords: ['delete range', 'typora', 'paragraph', 'block', 'list item'],
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-delete-block') ?? false,
    },
    {
      id: 'edit.delete-styled-scope',
      label: 'Delete Styled Scope',
      category: 'Edit',
      description: 'Remove the innermost inline style wrapper under the caret',
      keywords: ['delete range', 'typora', 'style', 'inline', 'bold', 'italic', 'link'],
      shortcut: 'Mod+Shift+E',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-delete-styled-scope') ?? false,
    },
    {
      id: 'edit.undo',
      label: 'Undo',
      category: 'Edit',
      description: 'Revert the last edit',
      keywords: ['history', 'back'],
      shortcut: 'Mod+Z',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-undo') ?? false,
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      category: 'Edit',
      description: 'Reapply the last undone edit',
      keywords: ['history', 'forward'],
      shortcut: 'Mod+Shift+Z',
      focusEditorAfterRun: true,
      run: () => editorRef.current?.executeCommand('edit-redo') ?? false,
    },
    {
      id: 'edit.copy-as-markdown',
      label: 'Copy as Markdown',
      category: 'Edit',
      description: 'Write the current markdown selection to the clipboard',
      keywords: ['clipboard', 'source'],
      run: async () => {
        await handleCopyAction('copy-as-markdown')
        return true
      },
    },
    {
      id: 'export.html',
      label: 'Export HTML',
      category: 'Export',
      description: 'Render the current document to an HTML file',
      keywords: ['save as html', 'web'],
      run: async () => {
        await handleExport('html')
        return true
      },
    },
    {
      id: 'export.pdf',
      label: 'Export PDF',
      category: 'Export',
      description: 'Render the current document to a PDF file',
      keywords: ['save as pdf', 'print'],
      run: async () => {
        await handleExport('pdf')
        return true
      },
    },
    {
      id: 'export.docx',
      label: 'Export DOCX',
      category: 'Export',
      description: 'Convert the current document to Microsoft Word',
      keywords: ['word', 'pandoc'],
      run: async () => {
        await handlePandocExport('export-docx')
        return true
      },
    },
  ]

  const handleCommandPaletteSelect = async (action: CommandPaletteAction) => {
    const didRun = await action.run()
    if (didRun === false) {
      return
    }

    setIsCommandPaletteOpen(false)

    if (action.focusEditorAfterRun) {
      queueMicrotask(() => {
        editorRef.current?.focus()
      })
    }
  }

  const activeAppearance = themeState?.activeAppearance ?? 'light'
  const appearancePreference = themeState?.appearancePreference ?? 'system'

  const outlineHeadings = activeTab?.largeFile ? [] : activeTab?.symbolTable.headings ?? []

  const activeOutlineAnchor = useMemo(
    () => findActiveHeadingAnchor(outlineHeadings, activeTab?.cursorPosition ?? activeTab?.viewportPosition ?? 0),
    [activeTab?.cursorPosition, activeTab?.viewportPosition, outlineHeadings],
  )

  const handleOutlineNavigate = useCallback((position: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (currentActiveTabId) {
      const currentTab = tabsRef.current.find((tab) => tab.id === currentActiveTabId) ?? null
      const currentLocation = captureActiveNavigationLocation()
      const destination =
        currentTab == null
          ? null
          : ({
              tabId: currentTab.id,
              filePath: currentTab.filePath,
              cursorPosition: position,
              scrollTop: null,
              preserveScroll: false,
            } satisfies PendingNavigationTarget)

      if (currentLocation && destination) {
        navigationHistoryRef.current = pushNavigationHistoryEntry(
          navigationHistoryRef.current,
          currentLocation,
          destination,
        )
      }

      if (destination) {
        setPendingNavigationTarget(destination)
        return
      }
    }

    requestEditorNavigation({
      tabId: currentActiveTabId,
      filePath: activeTabIdRef.current
        ? tabsRef.current.find((tab) => tab.id === activeTabIdRef.current)?.filePath ?? null
        : null,
      cursorPosition: position,
      scrollTop: null,
      preserveScroll: false,
    })
  }, [captureActiveNavigationLocation, requestEditorNavigation])

  const handleGoToLine = useCallback(
    async (lineNumber: number) => {
      if (activeTab?.largeFile && activeTab.filePath) {
        const api = window.markflow
        if (!api) {
          return
        }

        const payload = await api.readLargeFileWindow(activeTab.filePath, lineNumber)
        if (!payload?.largeFile) {
          return
        }

        const nextPosition = getLineStartPosition(
          payload.content,
          payload.largeFile.anchorLine - payload.largeFile.windowStartLine + 1,
        )
        const currentActiveTabId = activeTabIdRef.current
        if (currentActiveTabId) {
          updateTab(currentActiveTabId, (tab) =>
            tab.filePath !== activeTab.filePath
              ? tab
              : {
                  ...tab,
                  largeFile: payload.largeFile ?? null,
                  content: payload.content,
                  persistedContent: payload.content,
                  isDirty: false,
                  collapsedRanges: [],
                  cursorPosition: nextPosition,
                  viewportPosition: null,
                  selectionText: '',
                  symbolTable: createEmptySymbolTable(),
                  snapshot: null,
                },
          )
        }

        editorNavigationKeyRef.current += 1
        setEditorNavigationRequest({
          key: editorNavigationKeyRef.current,
          position: nextPosition,
        })
        setIsGoToLineOpen(false)
        return
      }

      editorNavigationKeyRef.current += 1
      setEditorNavigationRequest({
        key: editorNavigationKeyRef.current,
        position: getLineStartPosition(activeTab?.content ?? '', lineNumber),
      })
      setIsGoToLineOpen(false)
    },
    [activeTab?.content, activeTab?.filePath, activeTab?.largeFile, updateTab],
  )

  const handleSymbolTableChange = useCallback((table: SymbolTable, content: string) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => {
      if (tab.largeFile || content !== tab.content) {
        return tab
      }

      return {
        ...tab,
        symbolTable: table,
      }
    })
  }, [updateTab])

  const handleCollapsedRangesChange = useCallback((nextRanges: number[]) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => {
      if (tab.largeFile || areCollapsedRangesEqual(tab.collapsedRanges, nextRanges)) {
        return tab
      }

      return {
        ...tab,
        collapsedRanges: [...nextRanges],
      }
    })
  }, [updateTab])

  const handleCursorPositionChange = useCallback((position: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) =>
      tab.cursorPosition === position
        ? tab
        : {
            ...tab,
            cursorPosition: position,
          },
    )
  }, [updateTab])

  const handleViewportPositionChange = useCallback((position: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) =>
      tab.viewportPosition === position
        ? tab
        : {
            ...tab,
            viewportPosition: position,
          },
    )
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

  const handleMinimapNavigate = useCallback((lineNumber: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId || !activeTab || activeTab.largeFile) {
      return
    }

    const position = getLineStartPosition(activeTab.content, lineNumber)
    updateTab(currentActiveTabId, (tab) =>
      tab.id !== currentActiveTabId
        ? tab
        : {
            ...tab,
            cursorPosition: position,
            viewportPosition: position,
          },
    )
    editorNavigationKeyRef.current += 1
    setEditorNavigationRequest({
      key: editorNavigationKeyRef.current,
      position,
    })
  }, [activeTab, updateTab])

  const docStats = useMemo(
    () =>
      computeStats(activeTab?.content ?? '', activeTab?.selectionText ?? '', {
        excludeFencedCode: statisticsPreferences.excludeFencedCode,
      }),
    [activeTab?.content, activeTab?.selectionText, statisticsPreferences.excludeFencedCode],
  )
  const hasSelectionStats = (activeTab?.selectionText ?? '').length > 0
  const statisticsRows = [
    {
      label: 'Words',
      documentValue: docStats.words.toLocaleString(),
      selectionValue: docStats.selectionWords.toLocaleString(),
    },
    {
      label: 'Characters',
      documentValue: docStats.chars.toLocaleString(),
      selectionValue: docStats.selectionChars.toLocaleString(),
    },
    {
      label: 'Characters (no spaces)',
      documentValue: docStats.charsNoSpaces.toLocaleString(),
      selectionValue: docStats.selectionCharsNoSpaces.toLocaleString(),
    },
    {
      label: 'Paragraphs',
      documentValue: docStats.paragraphs.toLocaleString(),
      selectionValue: docStats.selectionParagraphs.toLocaleString(),
    },
    {
      label: 'Reading time',
      documentValue: formatReadingTime(docStats.readingMinutes),
      selectionValue: formatReadingTime(docStats.selectionReadingMinutes),
    },
  ]

  const activeDocumentName = activeTab ? getTabLabel(activeTab, loadingFile) : 'Untitled'
  const largeFileNotice = activeTab?.largeFile
    ? `Large-file mode: showing lines ${activeTab.largeFile.windowStartLine.toLocaleString()}-${activeTab.largeFile.windowEndLine.toLocaleString()} of ${activeTab.largeFile.totalLines.toLocaleString()}. Editing and export stay disabled to keep memory bounded.`
    : null

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
          {activeTab?.isDirty && (
            <span className="mf-titlebar-dirty-dot" aria-hidden="true" />
          )}
          <span className="mf-titlebar-document">
            {activeDocumentName}
          </span>
        </div>
        <div className="mf-titlebar-right">
          {themes.length > 0 && themeState ? (
            <div className="mf-theme-controls" aria-label="Theme preferences">
              <button
                type="button"
                className={`mf-theme-appearance-pill${appearancePreference === 'system' ? '' : ' mf-theme-appearance-pill-clickable'}`}
                aria-live="polite"
                disabled={appearancePreference === 'system'}
                onClick={() => void handleThemeAppearancePreferenceChange('system')}
                title={
                  appearancePreference === 'system'
                    ? `Following system ${formatAppearanceLabel(activeAppearance).toLowerCase()} appearance`
                    : 'Return to system appearance'
                }
              >
                {appearancePreference === 'system'
                  ? `${formatAppearanceLabel(activeAppearance)} mode`
                  : `${formatAppearanceLabel(activeAppearance)} locked`}
              </button>
              <div
                className={`mf-theme-select-group${activeAppearance === 'light' ? ' mf-theme-select-group-active' : ''}`}
                data-appearance="light"
              >
                <button
                  type="button"
                  className="mf-theme-select-label-button"
                  onClick={() => void handleThemeAppearancePreferenceChange('light')}
                  aria-pressed={activeAppearance === 'light'}
                  title="Activate light appearance"
                >
                  Light
                </button>
                <select
                  className="mf-theme-select"
                  value={themeState.lightThemeId}
                  onChange={(event) => void handleThemeChange('light', event)}
                  aria-label="Light theme"
                >
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`mf-theme-select-group${activeAppearance === 'dark' ? ' mf-theme-select-group-active' : ''}`}
                data-appearance="dark"
              >
                <button
                  type="button"
                  className="mf-theme-select-label-button"
                  onClick={() => void handleThemeAppearancePreferenceChange('dark')}
                  aria-pressed={activeAppearance === 'dark'}
                  title="Activate dark appearance"
                >
                  Dark
                </button>
                <select
                  className="mf-theme-select"
                  value={themeState.darkThemeId}
                  onChange={(event) => void handleThemeChange('dark', event)}
                  aria-label="Dark theme"
                >
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <button
            className={`mf-mode-toggle${typewriterMode ? ' mf-mode-active' : ''}`}
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
            Typewriter
          </button>
          <button
            className={`mf-mode-toggle${focusMode ? ' mf-mode-active' : ''}`}
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
            Focus
          </button>
          <button
            className={`mf-mode-toggle${showSidebar ? ' mf-mode-active' : ''}`}
            onClick={() => setShowSidebar((v) => !v)}
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
      {!isImmersiveMode ? (
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
                ×
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
              onFileOpen={(fp) => void handleOpenPath(fp)}
              onFileRename={(old, newName) => void handleVaultFileRename(old, newName)}
              onFileDelete={(fp) => void handleVaultFileDelete(fp)}
              onOpenFolder={() => void handleOpenFolder()}
            />
          </div>
        ) : null}
        <div className="mf-body">
          <div ref={editorShellRef} className="mf-editor-shell">
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
                onCursorPositionChange={handleCursorPositionChange}
                onViewportPositionChange={handleViewportPositionChange}
                onScrollMetricsChange={handleScrollMetricsChange}
                onSymbolTableChange={handleSymbolTableChange}
                onNavigationHandled={() => setEditorNavigationRequest(null)}
                onOpenPath={(filePath) => handleOpenPath(filePath, { pushHistory: true })}
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
          {outlineHeadings.length > 0 && !isImmersiveMode ? (
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
        <footer className="mf-statusbar" aria-label="Document statistics">
          <button
            ref={documentStatisticsButtonRef}
            type="button"
            className={`mf-statusbar-summary${isDocumentStatisticsOpen ? ' mf-statusbar-summary-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={isDocumentStatisticsOpen}
            aria-label={isDocumentStatisticsOpen ? 'Hide document statistics' : 'Show document statistics'}
            onClick={() => {
              toggleDocumentStatistics()
            }}
          >
            <span className="mf-statusbar-stat">{docStats.words.toLocaleString()} words</span>
            <span className="mf-statusbar-sep" aria-hidden="true">·</span>
            <span className="mf-statusbar-stat">{docStats.lines.toLocaleString()} lines</span>
            <span className="mf-statusbar-sep" aria-hidden="true">·</span>
            <span className="mf-statusbar-stat">{docStats.chars.toLocaleString()} characters</span>
            <span className="mf-statusbar-sep" aria-hidden="true">·</span>
            <span className="mf-statusbar-stat">{formatReadingTime(docStats.readingMinutes, 'statusbar')}</span>
            {activeTab?.largeFile ? (
              <>
                <span className="mf-statusbar-sep" aria-hidden="true">·</span>
                <span className="mf-statusbar-stat">
                  line {currentLineNumber.toLocaleString()} / {totalLines.toLocaleString()}
                </span>
                <span className="mf-statusbar-sep" aria-hidden="true">·</span>
                <span className="mf-statusbar-stat">
                  window {activeTab.largeFile.windowStartLine.toLocaleString()}-{activeTab.largeFile.windowEndLine.toLocaleString()}
                </span>
              </>
            ) : null}
            {hasSelectionStats ? (
              <>
                <span className="mf-statusbar-sep" aria-hidden="true">|</span>
                <span className="mf-statusbar-stat mf-statusbar-selection">
                  sel: {docStats.selectionWords}w / {docStats.selectionChars}c
                </span>
              </>
            ) : null}
          </button>
          {isDocumentStatisticsOpen ? (
            <section
              ref={documentStatisticsPanelRef}
              className="mf-statistics-popover"
              role="dialog"
              aria-label="Document statistics"
            >
              <div className="mf-spellcheck-popover-header">
                <div>
                  <p className="mf-spellcheck-popover-title">Document Statistics</p>
                  <p className="mf-spellcheck-popover-copy">
                    Live totals update as you edit. Selection metrics appear when text is highlighted.
                  </p>
                </div>
              </div>
              <table className="mf-statistics-table">
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Document</th>
                    {hasSelectionStats ? <th scope="col">Selection</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {statisticsRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.documentValue}</td>
                      {hasSelectionStats ? <td>{row.selectionValue}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="mf-image-upload-checkbox">
                <input
                  type="checkbox"
                  checked={statisticsPreferences.excludeFencedCode}
                  onChange={(event) =>
                    updateStatisticsPreferences({
                      ...statisticsPreferences,
                      excludeFencedCode: event.target.checked,
                    })
                  }
                />
                <span>Exclude fenced code blocks from counts</span>
              </label>
              {!hasSelectionStats ? (
                <p className="mf-statistics-copy">Select one or more blocks to compare document and selection totals.</p>
              ) : null}
              <p className="mf-statistics-copy">
                Words ignore markdown formatting markers. Character counts keep source punctuation inside the included text.
              </p>
            </section>
          ) : null}
          <div className="mf-statusbar-actions">
          <button
            ref={markdownModeButtonRef}
            type="button"
            className={`mf-statusbar-button${isMarkdownModeSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={isMarkdownModeSettingsOpen}
            aria-label="Markdown mode settings"
            onClick={() => {
              setIsDocumentStatisticsOpen(false)
              setIsHeadingNumberingSettingsOpen(false)
              setIsSourceLineNumbersSettingsOpen(false)
              setIsSpellCheckSettingsOpen(false)
              setIsImageUploadSettingsOpen(false)
              setIsMarkdownModeSettingsOpen((current) => !current)
            }}
          >
            {formatMarkdownModeStatus(markdownMode)}
          </button>
          {isMarkdownModeSettingsOpen ? (
            <section
              ref={markdownModePanelRef}
              className="mf-spellcheck-popover"
              role="dialog"
              aria-label="Markdown mode settings"
            >
              <div className="mf-spellcheck-popover-header">
                <div>
                  <p className="mf-spellcheck-popover-title">Markdown Mode</p>
                  <p className="mf-spellcheck-popover-copy">
                    Strict mode follows GFM-style heading whitespace and ordered-list indentation
                    more closely. The choice is remembered for the next launch.
                  </p>
                </div>
              </div>
              <label className="mf-image-upload-checkbox">
                <input
                  type="radio"
                  name="markdown-mode"
                  checked={markdownMode === 'tolerant'}
                  onChange={() => updateMarkdownModePreference('tolerant')}
                />
                <span>Tolerant markdown parsing</span>
              </label>
              <label className="mf-image-upload-checkbox">
                <input
                  type="radio"
                  name="markdown-mode"
                  checked={markdownMode === 'strict'}
                  onChange={() => updateMarkdownModePreference('strict')}
                />
                <span>Strict markdown parsing</span>
              </label>
            </section>
          ) : null}
          <button
            ref={headingNumberingButtonRef}
            type="button"
            className={`mf-statusbar-button${isHeadingNumberingSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={isHeadingNumberingSettingsOpen}
            aria-label="Heading numbering settings"
            onClick={() => {
              setIsDocumentStatisticsOpen(false)
              setIsMarkdownModeSettingsOpen(false)
              setIsSourceLineNumbersSettingsOpen(false)
              setIsSpellCheckSettingsOpen(false)
              setIsImageUploadSettingsOpen(false)
              setIsHeadingNumberingSettingsOpen((current) => !current)
            }}
          >
            {formatHeadingNumberingStatus(headingNumberingEnabled)}
          </button>
          {isHeadingNumberingSettingsOpen ? (
            <section
              ref={headingNumberingPanelRef}
              className="mf-spellcheck-popover"
              role="dialog"
              aria-label="Heading numbering settings"
            >
              <div className="mf-spellcheck-popover-header">
                <div>
                  <p className="mf-spellcheck-popover-title">Heading Numbering</p>
                  <p className="mf-spellcheck-popover-copy">
                    Adds CSS-counter prefixes to rendered headings, the outline, and HTML/PDF exports
                    without rewriting the markdown source.
                  </p>
                </div>
              </div>
              <label className="mf-image-upload-checkbox">
                <input
                  type="checkbox"
                  checked={headingNumberingEnabled}
                  onChange={(event) => updateHeadingNumberingPreference(event.target.checked)}
                />
                <span>Enable heading auto-numbering</span>
              </label>
            </section>
          ) : null}
          <button
            ref={sourceLineNumbersButtonRef}
            type="button"
            className={`mf-statusbar-button${isSourceLineNumbersSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={isSourceLineNumbersSettingsOpen}
            aria-label="Source line-number settings"
            onClick={() => {
              setIsDocumentStatisticsOpen(false)
              setIsMarkdownModeSettingsOpen(false)
              setIsHeadingNumberingSettingsOpen(false)
              setIsSpellCheckSettingsOpen(false)
              setIsImageUploadSettingsOpen(false)
              setIsSourceLineNumbersSettingsOpen((current) => !current)
            }}
          >
            {formatSourceLineNumbersStatus(sourceLineNumbersEnabled)}
          </button>
          {isSourceLineNumbersSettingsOpen ? (
            <section
              ref={sourceLineNumbersPanelRef}
              className="mf-spellcheck-popover"
              role="dialog"
              aria-label="Source line-number settings"
            >
              <div className="mf-spellcheck-popover-header">
                <div>
                  <p className="mf-spellcheck-popover-title">Source Line Numbers</p>
                  <p className="mf-spellcheck-popover-copy">
                    Shows a 1-based gutter only in Source mode so raw markdown keeps line context
                    without adding chrome to Preview, Reading, or Split views.
                  </p>
                </div>
              </div>
              <label className="mf-image-upload-checkbox">
                <input
                  type="checkbox"
                  checked={sourceLineNumbersEnabled}
                  onChange={(event) => updateSourceLineNumbersPreference(event.target.checked)}
                />
                <span>Show line numbers in source mode</span>
              </label>
            </section>
          ) : null}
          {imageUploadSettings ? (
            <>
              <button
                ref={imageUploadButtonRef}
                type="button"
                className={`mf-statusbar-button${isImageUploadSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={isImageUploadSettingsOpen}
                aria-label="Image upload preferences"
                onClick={() => {
                  setIsDocumentStatisticsOpen(false)
                  setIsMarkdownModeSettingsOpen(false)
                  setIsHeadingNumberingSettingsOpen(false)
                  setIsSourceLineNumbersSettingsOpen(false)
                  setIsSpellCheckSettingsOpen(false)
                  setIsImageUploadSettingsOpen((current) => !current)
                }}
              >
                {formatImageUploadStatus(imageUploadSettings)}
              </button>
              {isImageUploadSettingsOpen ? (
                <section
                  ref={imageUploadPanelRef}
                  className="mf-image-upload-popover"
                  role="dialog"
                  aria-label="Image upload preferences"
                >
                  <div className="mf-spellcheck-popover-header">
                    <div>
                      <p className="mf-spellcheck-popover-title">Image Upload</p>
                      <p className="mf-spellcheck-popover-copy">
                        Auto-routes pasted and dropped images through PicGo-compatible commands.
                      </p>
                    </div>
                  </div>
                  <label className="mf-image-upload-checkbox">
                    <input
                      type="checkbox"
                      checked={imageUploadSettings.autoUploadOnInsert}
                      onChange={(event) =>
                        updateImageUploadSettings({ autoUploadOnInsert: event.target.checked })
                      }
                    />
                    <span>Upload pasted and dropped images automatically</span>
                  </label>
                  <label className="mf-spellcheck-field">
                    <span className="mf-spellcheck-field-label">Uploader preset</span>
                    <select
                      className="mf-theme-select"
                      value={imageUploadSettings.uploaderKind}
                      onChange={(event) =>
                        updateImageUploadSettings({
                          uploaderKind: event.target.value as MarkFlowImageUploadSettings['uploaderKind'],
                        })
                      }
                      aria-label="Image uploader type"
                    >
                      <option value="disabled">Disabled</option>
                      <option value="picgo-core">PicGo Core</option>
                      <option value="custom-command">Custom command</option>
                    </select>
                  </label>
                  {imageUploadSettings.uploaderKind !== 'disabled' ? (
                    <>
                      <label className="mf-spellcheck-field">
                        <span className="mf-spellcheck-field-label">Command</span>
                        <input
                          className="mf-spellcheck-input"
                          type="text"
                          value={imageUploadSettings.command}
                          onChange={(event) =>
                            updateImageUploadSettings({ command: event.target.value })
                          }
                          placeholder={imageUploadSettings.uploaderKind === 'picgo-core' ? 'picgo' : '/path/to/upload-image'}
                          aria-label="Image uploader command"
                        />
                      </label>
                      <label className="mf-spellcheck-field">
                        <span className="mf-spellcheck-field-label">Arguments</span>
                        <input
                          className="mf-spellcheck-input"
                          type="text"
                          value={imageUploadSettings.arguments}
                          onChange={(event) =>
                            updateImageUploadSettings({ arguments: event.target.value })
                          }
                          placeholder={imageUploadSettings.uploaderKind === 'picgo-core' ? 'upload' : '--flag value'}
                          aria-label="Image uploader arguments"
                        />
                      </label>
                      <label className="mf-spellcheck-field">
                        <span className="mf-spellcheck-field-label">Asset directory</span>
                        <input
                          className="mf-spellcheck-input"
                          type="text"
                          value={imageUploadSettings.assetDirectoryName}
                          onChange={(event) =>
                            updateImageUploadSettings({ assetDirectoryName: event.target.value })
                          }
                          placeholder="assets"
                          aria-label="Image asset directory"
                        />
                      </label>
                      <label className="mf-spellcheck-field">
                        <span className="mf-spellcheck-field-label">Timeout (ms)</span>
                        <input
                          className="mf-spellcheck-input"
                          type="number"
                          min={1000}
                          step={1000}
                          value={imageUploadSettings.timeoutMs}
                          onChange={(event) =>
                            updateImageUploadSettings({
                              timeoutMs: Number.parseInt(event.target.value || '0', 10),
                            })
                          }
                          aria-label="Image upload timeout"
                        />
                      </label>
                      <label className="mf-image-upload-checkbox">
                        <input
                          type="checkbox"
                          checked={imageUploadSettings.keepLocalCopyAfterUpload}
                          onChange={(event) =>
                            updateImageUploadSettings({
                              keepLocalCopyAfterUpload: event.target.checked,
                            })
                          }
                        />
                        <span>Keep the managed local copy after a successful upload</span>
                      </label>
                      <p className="mf-image-upload-copy">
                        {'`${filename}` and `${filepath}` expand against the current markdown file, and the image path is appended as the final command argument.'}
                      </p>
                    </>
                  ) : (
                    <p className="mf-image-upload-copy">
                      Enable a preset to rewrite inserted local images to remote URLs while keeping a local
                      fallback on upload failure.
                    </p>
                  )}
                </section>
              ) : null}
            </>
          ) : null}
          <button
            ref={spellCheckButtonRef}
            type="button"
            className={`mf-statusbar-button${isSpellCheckSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={isSpellCheckSettingsOpen}
            aria-label="Spellcheck settings"
            onClick={() => {
              setIsDocumentStatisticsOpen(false)
              setIsMarkdownModeSettingsOpen(false)
              setIsHeadingNumberingSettingsOpen(false)
              setIsSourceLineNumbersSettingsOpen(false)
              setIsImageUploadSettingsOpen(false)
              setIsSpellCheckSettingsOpen((current) => !current)
            }}
          >
            Spell: {formatSpellCheckLanguageLabel(spellCheckState.selectedLanguage)}
          </button>
          {isSpellCheckSettingsOpen ? (
            <section
              ref={spellCheckPanelRef}
              className="mf-spellcheck-popover"
              role="dialog"
              aria-label="Spellcheck settings"
            >
              <div className="mf-spellcheck-popover-header">
                <div>
                  <p className="mf-spellcheck-popover-title">Spellcheck</p>
                  <p className="mf-spellcheck-popover-copy">Applies to this MarkFlow profile.</p>
                </div>
              </div>
              <label className="mf-spellcheck-field">
                <span className="mf-spellcheck-field-label">Dictionary language</span>
                <select
                  className="mf-theme-select"
                  value={spellCheckState.selectedLanguage ?? ''}
                  onChange={(event) => void handleSpellCheckLanguageChange(event)}
                  aria-label="Spellcheck language"
                >
                  <option value="">Default</option>
                  {spellCheckState.availableLanguages.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </label>
              <form className="mf-spellcheck-add-form" onSubmit={(event) => void handleSpellCheckWordSubmit(event)}>
                <label className="mf-spellcheck-field">
                  <span className="mf-spellcheck-field-label">Custom dictionary</span>
                  <input
                    className="mf-spellcheck-input"
                    type="text"
                    value={spellCheckWordInput}
                    onChange={(event) => setSpellCheckWordInput(event.target.value)}
                    placeholder="Add a domain term"
                    aria-label="Add custom spellcheck word"
                  />
                </label>
                <button
                  type="submit"
                  className="mf-spellcheck-submit"
                  disabled={sanitizeSpellCheckWord(spellCheckWordInput) == null}
                >
                  Add word
                </button>
              </form>
              <div className="mf-spellcheck-word-list" aria-label="Custom spellcheck words">
                {spellCheckState.customWords.length > 0 ? (
                  spellCheckState.customWords.map((word) => (
                    <button
                      key={word}
                      type="button"
                      className="mf-spellcheck-word-chip"
                      aria-label={`Remove ${word} from custom dictionary`}
                      onClick={() => void handleSpellCheckWordRemove(word)}
                    >
                      <span>{word}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))
                ) : (
                  <p className="mf-spellcheck-empty">No custom words yet.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>
        </footer>
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
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelect={(action: RegisteredCommandPaletteAction) => void handleCommandPaletteSelect(action)}
      />

      <QuickOpen
        isOpen={isQuickOpenOpen}
        items={quickOpenItems}
        onClose={() => setIsQuickOpenOpen(false)}
        onSelect={handleQuickOpenSelect}
      />

      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        folderPath={vaultPath}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSelectResult={handleGlobalSearchResult}
      />

      <GoToLine
        isOpen={isGoToLineOpen}
        currentLine={currentLineNumber}
        totalLines={totalLines}
        onClose={() => setIsGoToLineOpen(false)}
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
