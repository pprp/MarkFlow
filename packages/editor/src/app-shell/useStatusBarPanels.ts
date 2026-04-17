import { useCallback, useEffect, useRef, useState } from 'react'

type StatusBarPanel =
  | 'documentStatistics'
  | 'markdownMode'
  | 'headingNumbering'
  | 'sourceLineNumbers'
  | 'spellCheck'
  | 'imageUpload'

export function useStatusBarPanels() {
  const [isDocumentStatisticsOpen, setIsDocumentStatisticsOpen] = useState(false)
  const [isMarkdownModeSettingsOpen, setIsMarkdownModeSettingsOpen] = useState(false)
  const [isSpellCheckSettingsOpen, setIsSpellCheckSettingsOpen] = useState(false)
  const [isHeadingNumberingSettingsOpen, setIsHeadingNumberingSettingsOpen] = useState(false)
  const [isSourceLineNumbersSettingsOpen, setIsSourceLineNumbersSettingsOpen] = useState(false)
  const [isImageUploadSettingsOpen, setIsImageUploadSettingsOpen] = useState(false)

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

  const closeStatusbarPanels = useCallback(() => {
    setIsDocumentStatisticsOpen(false)
    setIsMarkdownModeSettingsOpen(false)
    setIsHeadingNumberingSettingsOpen(false)
    setIsSourceLineNumbersSettingsOpen(false)
    setIsSpellCheckSettingsOpen(false)
    setIsImageUploadSettingsOpen(false)
  }, [])

  const togglePanel = useCallback((panel: StatusBarPanel) => {
    setIsDocumentStatisticsOpen(panel === 'documentStatistics' ? (current) => !current : false)
    setIsMarkdownModeSettingsOpen(panel === 'markdownMode' ? (current) => !current : false)
    setIsHeadingNumberingSettingsOpen(panel === 'headingNumbering' ? (current) => !current : false)
    setIsSourceLineNumbersSettingsOpen(panel === 'sourceLineNumbers' ? (current) => !current : false)
    setIsSpellCheckSettingsOpen(panel === 'spellCheck' ? (current) => !current : false)
    setIsImageUploadSettingsOpen(panel === 'imageUpload' ? (current) => !current : false)
  }, [])

  const toggleDocumentStatistics = useCallback(() => {
    togglePanel('documentStatistics')
    return true
  }, [togglePanel])

  const toggleMarkdownModeSettings = useCallback(() => {
    togglePanel('markdownMode')
  }, [togglePanel])

  const toggleHeadingNumberingSettings = useCallback(() => {
    togglePanel('headingNumbering')
  }, [togglePanel])

  const toggleSourceLineNumbersSettings = useCallback(() => {
    togglePanel('sourceLineNumbers')
  }, [togglePanel])

  const toggleSpellCheckSettings = useCallback(() => {
    togglePanel('spellCheck')
  }, [togglePanel])

  const toggleImageUploadSettings = useCallback(() => {
    togglePanel('imageUpload')
  }, [togglePanel])

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

    const containers = [
      documentStatisticsPanelRef.current,
      documentStatisticsButtonRef.current,
      markdownModePanelRef.current,
      markdownModeButtonRef.current,
      headingNumberingPanelRef.current,
      headingNumberingButtonRef.current,
      sourceLineNumbersPanelRef.current,
      sourceLineNumbersButtonRef.current,
      spellCheckPanelRef.current,
      spellCheckButtonRef.current,
      imageUploadPanelRef.current,
      imageUploadButtonRef.current,
    ]

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        closeStatusbarPanels()
        return
      }

      if (containers.some((container) => container != null && container.contains(target))) {
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

  return {
    documentStatisticsButtonRef,
    documentStatisticsPanelRef,
    markdownModeButtonRef,
    markdownModePanelRef,
    headingNumberingButtonRef,
    headingNumberingPanelRef,
    sourceLineNumbersButtonRef,
    sourceLineNumbersPanelRef,
    spellCheckButtonRef,
    spellCheckPanelRef,
    imageUploadButtonRef,
    imageUploadPanelRef,
    isDocumentStatisticsOpen,
    isMarkdownModeSettingsOpen,
    isSpellCheckSettingsOpen,
    isHeadingNumberingSettingsOpen,
    isSourceLineNumbersSettingsOpen,
    isImageUploadSettingsOpen,
    closeStatusbarPanels,
    toggleDocumentStatistics,
    toggleMarkdownModeSettings,
    toggleHeadingNumberingSettings,
    toggleSourceLineNumbersSettings,
    toggleSpellCheckSettings,
    toggleImageUploadSettings,
  }
}

export type StatusBarPanelsController = ReturnType<typeof useStatusBarPanels>
