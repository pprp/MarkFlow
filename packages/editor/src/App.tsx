import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MarkFlowEditor,
  type MarkFlowEditorHandle,
  type MarkFlowEditorSnapshot,
} from './editor/MarkFlowEditor'
import { createEmptySymbolTable, type SymbolTable } from './editor/indexer'
import { findActiveHeadingAnchor } from './editor/outline'
import { computeStats } from './editor/wordCount'
import { CommandPalette } from './components/CommandPalette'
import { QuickOpen } from './components/QuickOpen'
import { VaultSidebar } from './components/VaultSidebar'
import { GlobalSearch } from './components/GlobalSearch'
import { GoToLine } from './components/GoToLine'
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
  type MarkFlowDesktopAPI,
  type MarkFlowQuickOpenItem,
  type MarkFlowDocument,
  type MarkFlowFilePayload,
  type MarkFlowFileLoadProgressPayload,
  type MarkFlowMenuAction,
  type MarkFlowRecoveryCheckpoint,
  type MarkFlowTabCloseAction,
  type MarkFlowThemeState,
  type MarkFlowThemeSummary,
  type ViewMode,
  type MarkFlowWindowSessionState,
  type SearchResult,
} from '@markflow/shared'

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

let tabIdCounter = 0
let untitledTabCounter = 0

interface DocumentTabState extends MarkFlowDocument {
  id: string
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

function createDocumentTab(filePath: string | null, content: string): DocumentTabState {
  return {
    id: createTabId(),
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
  const [showSidebar, setShowSidebar] = useState(false)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [vaultFiles, setVaultFiles] = useState<string[]>([])
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false)
  const [themes, setThemes] = useState<MarkFlowThemeSummary[]>([])
  const [themeState, setThemeState] = useState<MarkFlowThemeState | null>(null)
  const [editorNavigationRequest, setEditorNavigationRequest] = useState<{
    key: number
    position: number
  } | null>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [quickOpenItems, setQuickOpenItems] = useState<MarkFlowQuickOpenItem[]>([])
  const [tabs, setTabs] = useState<DocumentTabState[]>(() => [createDocumentTab(null, INITIAL_CONTENT)])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [closedTabs, setClosedTabs] = useState<ClosedDocumentTabState[]>([])
  const [loadingFile, setLoadingFile] = useState<MarkFlowFileLoadProgressPayload | null>(null)
  const tabsRef = useRef<DocumentTabState[]>(tabs)
  const activeTabIdRef = useRef<string | null>(null)
  const handleSaveTabRef = useRef<(tabId: string | null, forceSaveAs?: boolean) => Promise<boolean>>(
    async () => false,
  )
  const handleCloseTabRef = useRef<(tabId: string | null) => Promise<boolean>>(async () => false)
  const handleReopenClosedTabRef = useRef<() => Promise<boolean>>(async () => false)
  const handleCycleTabsRef = useRef<(direction: 1 | -1) => void>(() => {})
  const handleCopyActionRef = useRef<
    (action: 'copy' | 'copy-as-markdown' | 'copy-as-html-code') => Promise<void>
  >(async () => {})
  const handleExportRef = useRef<(format: 'html' | 'pdf') => Promise<void>>(async () => {})
  const handlePandocExportRef = useRef<
    (action: 'export-docx' | 'export-epub' | 'export-latex') => Promise<void>
  >(async () => {})
  const editorNavigationKeyRef = useRef(0)
  const pluginHostRef = useRef<MarkFlowPluginHost | null>(null)
  const editorRef = useRef<MarkFlowEditorHandle | null>(null)

  if (pluginHostRef.current === null) {
    pluginHostRef.current = new MarkFlowPluginHost()
    pluginHostRef.current.setPlugins([createExternalLinkBadgePlugin()])
  }

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
    const api = window.markflow
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

    const applyOpenedDocument = async ({ filePath, content }: { filePath: string | null; content: string }) => {
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
            filePathToLoad = filePath
            nextTabs = currentTabs.map((tab) =>
              tab.id === existingTab.id
                ? {
                    ...tab,
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
        const nextTab = createDocumentTab(filePath, content)
        nextActiveId = nextTab.id
        filePathToLoad = filePath
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

    const applyRecoveredDocument = async (
      checkpoint: MarkFlowRecoveryCheckpoint,
      persistedContent: string,
    ) => {
      captureActiveTabSnapshot()
      setLoadingFile(null)
      setEditorNavigationRequest(null)
      setIsGoToLineOpen(false)

      const currentTabs = tabsRef.current
      const existingTab = checkpoint.filePath
        ? currentTabs.find((tab) => tab.filePath === checkpoint.filePath)
        : null
      const nextTab = existingTab ? null : createDocumentTab(checkpoint.filePath, checkpoint.content)
      const nextActiveId = existingTab?.id ?? nextTab?.id ?? null
      const filePathToLoad = checkpoint.filePath
      const nextTabs = existingTab
        ? currentTabs.map((tab) =>
            tab.id === existingTab.id
              ? {
                  ...tab,
                  content: checkpoint.content,
                  persistedContent,
                  isDirty: checkpoint.content !== persistedContent,
                  cursorPosition: 0,
                  viewportPosition: null,
                  selectionText: '',
                  symbolTable: createEmptySymbolTable(),
                  snapshot: null,
                }
              : tab,
          )
        : [
            ...currentTabs,
            {
              ...(nextTab as DocumentTabState),
              persistedContent,
              isDirty: checkpoint.content !== persistedContent,
            },
          ]

      replaceTabs(nextTabs)

      if (nextActiveId) {
        replaceActiveTabId(nextActiveId)
      }
      if (nextActiveId && filePathToLoad) {
        await loadCollapsedRangesForTab(api, nextActiveId, filePathToLoad)
      }
    }

    const handleMenuAction = async ({ action }: { action: MarkFlowMenuAction }) => {
      switch (action) {
        case 'new-file':
          await api.newFile()
          break
        case 'open-file':
          await api.openFile()
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
    const unsubscribeThemeUpdated = api.onThemeUpdated(applyThemeState)

    void (async () => {
      let persistedDocuments: MarkFlowFilePayload[] = []
      const windowSession = await api.getWindowSession()
      if (windowSession?.documents.length) {
        const nextTabs = windowSession.documents.map((document) => createDocumentTab(document.filePath, document.content))
        const nextActiveTab =
          nextTabs.find((tab) => tab.filePath === windowSession.activeFilePath) ?? nextTabs[0] ?? null

        replaceTabs(nextTabs)
        replaceActiveTabId(nextActiveTab?.id ?? null)
        persistedDocuments = windowSession.documents
        await Promise.all(
          nextTabs.map((tab) => loadCollapsedRangesForTab(api, tab.id, tab.filePath)),
        )
      } else {
        const currentDocument = await api.getCurrentDocument()
        if (currentDocument) {
          persistedDocuments = [currentDocument]
          await applyOpenedDocument(currentDocument)
        }
      }

      const recoveryCheckpoint = await api.getRecoveryCheckpoint()
      if (!recoveryCheckpoint) {
        return
      }

      const recoveredName = recoveryCheckpoint.filePath?.split(/[\\/]/).at(-1) ?? 'untitled document'
      const shouldRecover = window.confirm(
        `Recover the auto-saved changes for ${recoveredName} from ${new Date(recoveryCheckpoint.savedAt).toLocaleString()}?`,
      )

      if (!shouldRecover) {
        await api.discardRecoveryCheckpoint()
        return
      }

      const persistedContent =
        persistedDocuments.find((document) => document.filePath === recoveryCheckpoint.filePath)?.content ?? ''
      await applyRecoveredDocument(recoveryCheckpoint, persistedContent)
    })()
    void api.getThemes().then(setThemes)
    void api.getThemeState().then((nextThemeState) => {
      applyThemeState(nextThemeState)
    })

    return () => {
      unsubscribeFileOpened()
      unsubscribeFileLoadingProgress()
      unsubscribeFileSaved()
      unsubscribeMenuAction()
      unsubscribeThemeUpdated()
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove()
    }
  }, [captureActiveTabSnapshot, loadCollapsedRangesForTab, replaceActiveTabId, replaceTabs, updateTabs])

  function toggleViewMode() {
    setViewMode((m) => (m === 'wysiwyg' ? 'source' : 'wysiwyg'))
  }

  function toggleFocusMode() {
    setFocusMode((v) => !v)
  }

  function toggleTypewriterMode() {
    setTypewriterMode((v) => !v)
  }

  const handleOpenCommandPalette = useCallback(() => {
    setIsQuickOpenOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(false)
    setIsCommandPaletteOpen(true)
  }, [])

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
    const result = await window.markflow?.openFolder()
    if (result) {
      setVaultPath(result.folderPath)
      setShowSidebar(true)
      const files = await window.markflow?.getVaultFiles(result.folderPath)
      setVaultFiles(files ?? [])
    }
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

  function handleGlobalSearchResult(result: SearchResult) {
    setIsGlobalSearchOpen(false)
    void handleOpenPath(result.filePath)
  }

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
        ? await api.saveFileAs(tab.content)
        : await api.saveFile(tab.content)
      if (!result?.success) {
        return false
      }

      const nextFilePath = result.filePath ?? tab.filePath
      if (nextFilePath) {
        await api.saveFoldState(nextFilePath, latestSnapshot?.collapsedRanges ?? tab.collapsedRanges)
      }

      updateTab(tabId, (currentTab) => ({
        ...currentTab,
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
    handleCycleTabsRef.current = handleCycleTabs
    handleSaveTabRef.current = handleSaveTab
    handleCloseTabRef.current = handleCloseTab
    handleReopenClosedTabRef.current = handleReopenClosedTab
  }, [handleCloseTab, handleCycleTabs, handleReopenClosedTab, handleSaveTab])

  const totalLines = useMemo(
    () => (activeTab?.content.length ? activeTab.content.split('\n').length : 1),
    [activeTab?.content],
  )

  const currentLineNumber = useMemo(
    () => getLineNumberAtPosition(activeTab?.content ?? '', activeTab?.cursorPosition ?? 0),
    [activeTab?.content, activeTab?.cursorPosition],
  )

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
    const api = window.markflow
    if (!api || !activeTab?.isDirty) return

    api.scheduleRecoveryCheckpoint({
      filePath: activeTab.filePath,
      content: activeTab.content,
    })
  }, [activeTab])

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
      const isNextTabKey = (!isMac && e.ctrlKey && e.key === 'Tab' && !e.shiftKey) || (e.metaKey && e.key === '`' && !e.shiftKey)
      const isPreviousTabKey =
        (!isMac && e.ctrlKey && e.key === 'Tab' && e.shiftKey) || (e.metaKey && e.key === '`' && e.shiftKey)
      const isReopenClosedTabKey = e.shiftKey && ((e.metaKey && lowerKey === 't') || (e.ctrlKey && lowerKey === 't'))

      if (isCommandPaletteKey) {
        e.preventDefault()
        handleOpenCommandPalette()
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
    handleOpenCommandPalette,
    handleOpenGoToLine,
    handleOpenQuickOpen,
    handleReopenClosedTab,
    handleToggleGlobalSearch,
  ])

  const handleQuickOpenSelect = async (item: MarkFlowQuickOpenItem) => {
    setIsQuickOpenOpen(false)
    await handleOpenPath(item.filePath)
  }


  const handlePandocExport = async (action: 'export-docx' | 'export-epub' | 'export-latex') => {
    const api = window.markflow
    if (!api || !activeTab) return

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
    if (!activeTab) {
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
<body class="mf-export-body">
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

  function handleContentChange(content: string) {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => ({
      ...tab,
      content,
      isDirty: content !== tab.persistedContent,
    }))
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

  async function handleOpenPath(filePath: string) {
    await window.markflow?.openPath(filePath)
  }

  async function handleThemeChange(appearance: MarkFlowAppearance, event: ChangeEvent<HTMLSelectElement>) {
    const nextThemeState = await window.markflow?.setThemeForAppearance(appearance, event.target.value)
    if (nextThemeState) {
      applyThemeState(nextThemeState)
    }
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
      id: 'view.toggle-focus-mode',
      label: 'Toggle Focus Mode',
      category: 'View',
      description: focusMode ? 'Leave focus mode' : 'Dim non-active paragraphs',
      keywords: ['distraction free', 'spotlight'],
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

  const outlineHeadings = activeTab?.symbolTable.headings ?? []

  const activeOutlineAnchor = useMemo(
    () => findActiveHeadingAnchor(outlineHeadings, activeTab?.cursorPosition ?? activeTab?.viewportPosition ?? 0),
    [activeTab?.cursorPosition, activeTab?.viewportPosition, outlineHeadings],
  )

  const handleOutlineNavigate = useCallback((position: number) => {
    const currentActiveTabId = activeTabIdRef.current
    if (currentActiveTabId) {
      updateTab(currentActiveTabId, (tab) => ({
        ...tab,
        viewportPosition: null,
        cursorPosition: position,
      }))
    }
    editorNavigationKeyRef.current += 1
    setEditorNavigationRequest({
      key: editorNavigationKeyRef.current,
      position,
    })
  }, [updateTab])

  const handleGoToLine = useCallback(
    (lineNumber: number) => {
      editorNavigationKeyRef.current += 1
      setEditorNavigationRequest({
        key: editorNavigationKeyRef.current,
        position: getLineStartPosition(activeTab?.content ?? '', lineNumber),
      })
      setIsGoToLineOpen(false)
    },
    [activeTab?.content],
  )

  const handleSymbolTableChange = useCallback((table: SymbolTable, content: string) => {
    const currentActiveTabId = activeTabIdRef.current
    if (!currentActiveTabId) {
      return
    }

    updateTab(currentActiveTabId, (tab) => {
      if (content !== tab.content) {
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
      if (areCollapsedRangesEqual(tab.collapsedRanges, nextRanges)) {
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

  const docStats = useMemo(
    () => computeStats(activeTab?.content ?? '', activeTab?.selectionText ?? ''),
    [activeTab?.content, activeTab?.selectionText],
  )

  const activeDocumentName = activeTab ? getTabLabel(activeTab, loadingFile) : 'Untitled'

  const loadingProgressPercent = loadingFile
    ? Math.min(100, Math.round((loadingFile.bytesRead / Math.max(loadingFile.totalBytes, 1)) * 100))
    : 0

  return (
    <div className="mf-app">
      <header className="mf-titlebar">
        {/* Spacer for macOS traffic lights (hiddenInset titleBarStyle) */}
        <div className="mf-titlebar-traffic-spacer" />
        <div className="mf-titlebar-left">
          <svg className="mf-logo-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 14 L7 6 L10 11 L13 8 L17 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="10" cy="3.5" r="1.5" fill="var(--mf-accent)" opacity="0.85"/>
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
              <span className="mf-theme-appearance-pill" aria-live="polite">
                {formatAppearanceLabel(activeAppearance)} mode
              </span>
              <label
                className={`mf-theme-select-group${activeAppearance === 'light' ? ' mf-theme-select-group-active' : ''}`}
              >
                <span className="mf-theme-select-label">Light</span>
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
              </label>
              <label
                className={`mf-theme-select-group${activeAppearance === 'dark' ? ' mf-theme-select-group-active' : ''}`}
              >
                <span className="mf-theme-select-label">Dark</span>
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
              </label>
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
              <rect x="1" y="3" width="10" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <rect x="3" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="5.4" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="7.8" y="5.5" width="1.2" height="1.2" rx="0.3" fill="currentColor"/>
              <rect x="3.8" y="7.5" width="4.4" height="1" rx="0.3" fill="currentColor" opacity="0.6"/>
              <rect x="3.5" y="1.2" width="5" height="1.2" rx="0.6" fill="currentColor" opacity="0.4"/>
            </svg>
            TW
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
      <main className="mf-main">
        {showSidebar && (
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
        )}
        <div className="mf-body">
          <div className="mf-editor-shell">
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
            {activeTab ? (
              <MarkFlowEditor
                key={activeTab.id}
                ref={editorRef}
                initialSnapshot={activeTab.snapshot}
                content={activeTab.content}
                viewMode={viewMode}
                onChange={handleContentChange}
                onCursorPositionChange={handleCursorPositionChange}
                onViewportPositionChange={handleViewportPositionChange}
                onSymbolTableChange={handleSymbolTableChange}
                onNavigationHandled={() => setEditorNavigationRequest(null)}
                onOpenPath={handleOpenPath}
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
          {outlineHeadings.length > 0 ? (
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
      <footer className="mf-statusbar" aria-label="Document statistics">
        <span className="mf-statusbar-stat">{docStats.words.toLocaleString()} words</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{docStats.lines.toLocaleString()} lines</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{docStats.chars.toLocaleString()} chars</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{docStats.readingMinutes} min read</span>
        {docStats.selectionChars > 0 && (
          <>
            <span className="mf-statusbar-sep" aria-hidden="true">|</span>
            <span className="mf-statusbar-stat mf-statusbar-selection">
              sel: {docStats.selectionWords}w / {docStats.selectionChars}c
            </span>
          </>
        )}
      </footer>

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
