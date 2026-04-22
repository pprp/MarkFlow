import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { SearchResult } from '@markflow/shared'
import { createEmptySymbolTable } from '../editor/indexer'
import type { MarkFlowEditorSnapshot } from '../editor/MarkFlowEditor'
import {
  canNavigateBack,
  canNavigateForward,
  createEmptyNavigationHistory,
  navigateBackInHistory,
  navigateForwardInHistory,
  pushNavigationHistoryEntry,
  type NavigationLocation,
} from '../editor/navigationHistory'
import { fileUrlToPath, resolveLinkHref } from '../editor/decorations/linkDecoration'
import { type DocumentTabState, type PendingNavigationTarget } from './documents'

type UseNavigationHistoryControllerOptions = {
  activeTab: DocumentTabState | null
  activeTabIdRef: MutableRefObject<string | null>
  captureActiveTabSnapshot: () => MarkFlowEditorSnapshot | null
  closeGlobalSearch: () => void
  closeGoToLine: () => void
  replaceActiveTabId: (nextActiveTabId: string | null) => void
  showToast: (message: string) => void
  tabsRef: MutableRefObject<DocumentTabState[]>
  updateTab: (tabId: string, updater: (tab: DocumentTabState) => DocumentTabState) => void
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

export function useNavigationHistoryController({
  activeTab,
  activeTabIdRef,
  captureActiveTabSnapshot,
  closeGlobalSearch,
  closeGoToLine,
  replaceActiveTabId,
  showToast,
  tabsRef,
  updateTab,
}: UseNavigationHistoryControllerOptions) {
  const [editorNavigationRequest, setEditorNavigationRequest] = useState<{
    key: number
    position: number
    selectionEnd?: number | null
    scrollTop?: number | null
  } | null>(null)
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<PendingNavigationTarget | null>(null)
  const editorNavigationKeyRef = useRef(0)
  const navigationHistoryRef = useRef(createEmptyNavigationHistory())

  const createNavigationLocationForTab = useCallback(
    (
      tab: DocumentTabState,
      overrides: Partial<PendingNavigationTarget> = {},
    ): PendingNavigationTarget => {
      const target: PendingNavigationTarget = {
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
      }

      if (typeof overrides.selectionEnd === 'number') {
        target.selectionEnd = overrides.selectionEnd
      }

      return target
    },
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
  }, [activeTabIdRef, captureActiveTabSnapshot, tabsRef])

  const requestEditorNavigation = useCallback(
    (target: PendingNavigationTarget) => {
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
        selectionEnd: target.selectionEnd,
        scrollTop: target.preserveScroll ? target.scrollTop : null,
      })
    },
    [activeTabIdRef, updateTab],
  )

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
      activeTabIdRef,
      captureActiveNavigationLocation,
      captureActiveTabSnapshot,
      createNavigationLocationForTab,
      replaceActiveTabId,
      showToast,
      tabsRef,
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
    [activeTabIdRef, replaceActiveTabId, showToast, tabsRef],
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

  const handleOpenPath = useCallback(
    async (filePath: string, options: { pushHistory?: boolean } = {}) =>
      openPathWithOptionalHistory(filePath, {
        missingMessage: 'That recent file is no longer available.',
        pushHistory: options.pushHistory ?? false,
      }),
    [openPathWithOptionalHistory],
  )

  const handleGlobalSearchResult = useCallback(
    async (result: SearchResult) => {
      closeGlobalSearch()

      const existingTab = tabsRef.current.find((tab) => tab.filePath === result.filePath) ?? null
      if (existingTab) {
        const cursorPosition = getLineColumnPosition(existingTab.content, result.lineNumber, result.matchStart)
        const destination = createNavigationLocationForTab(existingTab, {
          cursorPosition,
          selectionEnd: Math.max(
            cursorPosition,
            getLineColumnPosition(existingTab.content, result.lineNumber, result.matchEnd),
          ),
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

      const cursorPosition = getLineColumnPosition(payload.content, result.lineNumber, result.matchStart)
      const destination: PendingNavigationTarget = {
        tabId: null,
        filePath: result.filePath,
        cursorPosition,
        selectionEnd: Math.max(
          cursorPosition,
          getLineColumnPosition(payload.content, result.lineNumber, result.matchEnd),
        ),
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
    },
    [
      captureActiveNavigationLocation,
      closeGlobalSearch,
      createNavigationLocationForTab,
      openPathWithOptionalHistory,
      showToast,
      tabsRef,
    ],
  )

  const handleOutlineNavigate = useCallback(
    (position: number) => {
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
    },
    [activeTabIdRef, captureActiveNavigationLocation, requestEditorNavigation, tabsRef],
  )

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
        closeGoToLine()
        return
      }

      editorNavigationKeyRef.current += 1
      setEditorNavigationRequest({
        key: editorNavigationKeyRef.current,
        position: getLineStartPosition(activeTab?.content ?? '', lineNumber),
      })
      closeGoToLine()
    },
    [activeTab, activeTabIdRef, closeGoToLine, updateTab],
  )

  const handleMinimapNavigate = useCallback(
    (lineNumber: number) => {
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
    },
    [activeTab, activeTabIdRef, updateTab],
  )

  const clearEditorNavigationRequest = useCallback(() => {
    setEditorNavigationRequest(null)
  }, [])

  return {
    clearEditorNavigationRequest,
    editorNavigationRequest,
    handleGlobalSearchResult,
    handleGoToLine,
    handleMinimapNavigate,
    handleNavigateBack,
    handleNavigateForward,
    handleOpenPath,
    handleOutlineNavigate,
  }
}
