import { type Dispatch, type MutableRefObject, type RefObject, type SetStateAction, useEffect } from 'react'
import type {
  MarkFlowDesktopAPI,
  MarkFlowFileLoadProgressPayload,
  MarkFlowFilePayload,
  MarkFlowMenuActionPayload,
  MarkFlowRecoveryCheckpoint,
  MarkFlowThemeState,
  MarkFlowWindowState,
} from '@markflow/shared'
import { createEmptySymbolTable } from '../editor/indexer'
import type { MarkFlowEditorHandle } from '../editor/MarkFlowEditor'
import {
  INITIAL_CONTENT,
  createDocumentTab,
  type DocumentTabState,
  type MarkFlowStartupAPI,
} from './documents'

type UseDesktopBridgeOptions = {
  activeTabIdRef: MutableRefObject<string | null>
  applyThemeState: (nextThemeState: MarkFlowThemeState | null) => void
  captureActiveTabSnapshot: () => unknown
  clearEditorNavigationRequest: () => void
  closeGoToLine: () => void
  editorRef: RefObject<MarkFlowEditorHandle | null>
  handleCloseTabRef: MutableRefObject<(tabId: string | null) => Promise<boolean>>
  handleCopyActionRef: MutableRefObject<
    (action: 'copy' | 'copy-as-markdown' | 'copy-as-html-code') => Promise<void>
  >
  handleCycleTabsRef: MutableRefObject<(direction: 1 | -1) => void>
  handleExportRef: MutableRefObject<(format: 'html' | 'pdf') => Promise<void>>
  handleNavigateBackRef: MutableRefObject<() => Promise<boolean>>
  handleNavigateForwardRef: MutableRefObject<() => Promise<boolean>>
  handleOpenFolderPathRef: MutableRefObject<(folderPath: string) => Promise<boolean>>
  handleOpenQuickOpenRef: MutableRefObject<() => Promise<boolean>>
  handlePandocExportRef: MutableRefObject<
    (action: 'export-docx' | 'export-epub' | 'export-latex') => Promise<void>
  >
  handleReopenClosedTabRef: MutableRefObject<() => Promise<boolean>>
  handleSaveTabRef: MutableRefObject<(tabId: string | null, forceSaveAs?: boolean) => Promise<boolean>>
  loadCollapsedRangesForTab: (
    api: MarkFlowDesktopAPI,
    tabId: string,
    filePath: string | null,
  ) => Promise<void>
  openCommandPalette: () => void
  openGlobalSearch: () => boolean
  openGoToLine: () => boolean
  replaceActiveTabId: (nextActiveTabId: string | null) => void
  replaceTabs: (nextTabs: DocumentTabState[]) => DocumentTabState[]
  setLoadingFile: Dispatch<SetStateAction<MarkFlowFileLoadProgressPayload | null>>
  setOutlineCollapsed: Dispatch<SetStateAction<boolean>>
  setShowMinimap: Dispatch<SetStateAction<boolean>>
  setShowSidebar: Dispatch<SetStateAction<boolean>>
  setVaultFiles: Dispatch<SetStateAction<string[]>>
  setVaultPath: Dispatch<SetStateAction<string | null>>
  setWindowState: Dispatch<SetStateAction<MarkFlowWindowState>>
  tabsRef: MutableRefObject<DocumentTabState[]>
  toggleDistractionFreeMode: () => void
  toggleDocumentStatistics: () => boolean
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  updateTabs: (updater: (currentTabs: DocumentTabState[]) => DocumentTabState[]) => DocumentTabState[]
}

export function useDesktopBridge({
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
}: UseDesktopBridgeOptions) {
  useEffect(() => {
    const api = window.markflow
    if (!api) return

    const applyOpenedDocument = async ({ filePath, content, largeFile }: MarkFlowFilePayload) => {
      captureActiveTabSnapshot()
      setLoadingFile((current) => (current?.filePath === filePath ? null : current))
      clearEditorNavigationRequest()
      closeGoToLine()

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
      clearEditorNavigationRequest()
      closeGoToLine()

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

      await Promise.all(fileLoads.map(({ filePath, tabId }) => loadCollapsedRangesForTab(api, tabId, filePath)))
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
          openGoToLine()
          break
        case 'navigate-back':
          await handleNavigateBackRef.current()
          break
        case 'navigate-forward':
          await handleNavigateForwardRef.current()
          break
        case 'command-palette':
          openCommandPalette()
          break
        case 'quick-open':
          await handleOpenQuickOpenRef.current()
          break
        case 'global-search':
          openGlobalSearch()
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
      const startupState = await (api as MarkFlowStartupAPI).getStartupState()
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
      document.getElementById('mf-theme-overrides')?.remove()
    }
  }, [
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
  ])
}
