import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  useCallback,
  useMemo,
} from 'react'
import type { CommandPaletteAction } from '../components/commandPaletteRegistry'
import type { MarkFlowEditorHandle } from '../editor/MarkFlowEditor'

type UseCommandPaletteActionsOptions = {
  activeTabIdRef: MutableRefObject<string | null>
  closeCommandPalette: () => void
  editorRef: RefObject<MarkFlowEditorHandle | null>
  focusMode: boolean
  handleCopyAction: (action: 'copy' | 'copy-as-markdown' | 'copy-as-html-code') => Promise<void>
  handleExport: (format: 'html' | 'pdf') => Promise<boolean>
  handleNavigateBack: () => Promise<boolean>
  handleNavigateForward: () => Promise<boolean>
  handleOpenFolder: () => Promise<void>
  handleOpenGlobalSearch: () => boolean
  handleOpenGoToLine: () => boolean
  handleOpenQuickOpen: () => Promise<boolean>
  handlePandocExport: (action: 'export-docx' | 'export-epub' | 'export-latex') => Promise<boolean>
  handleSaveTab: (tabId: string | null, forceSaveAs?: boolean) => Promise<boolean>
  handleUploadSelectedImage: () => Promise<boolean>
  isDistractionFreeMode: boolean
  isDocumentStatisticsOpen: boolean
  outlineCollapsed: boolean
  setOutlineCollapsed: Dispatch<SetStateAction<boolean>>
  setShowMinimap: Dispatch<SetStateAction<boolean>>
  showMinimap: boolean
  toggleDistractionFreeMode: () => void
  toggleDocumentStatistics: () => boolean
  toggleFocusMode: () => void
  toggleTypewriterMode: () => void
  toggleViewMode: () => void
  typewriterMode: boolean
  viewMode: 'wysiwyg' | 'source' | 'reading' | 'split'
}

function describeViewModeToggle(viewMode: UseCommandPaletteActionsOptions['viewMode']) {
  if (viewMode === 'source') {
    return 'Switch to WYSIWYG mode'
  }

  if (viewMode === 'split') {
    return 'Split view remains active'
  }

  return 'Switch to source mode'
}

export function useCommandPaletteActions({
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
  handleUploadSelectedImage,
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
}: UseCommandPaletteActionsOptions) {
  const commandPaletteActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: 'view.toggle-wysiwyg',
        label: 'Toggle WYSIWYG Mode',
        category: 'View',
        description: describeViewModeToggle(viewMode),
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
        run: async () => handleSaveTab(activeTabIdRef.current),
      },
      {
        id: 'file.save-as',
        label: 'Save File As',
        category: 'File',
        description: 'Choose a new destination for this document',
        keywords: ['document', 'rename copy'],
        shortcut: 'Mod+Shift+S',
        run: async () => handleSaveTab(activeTabIdRef.current, true),
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
        id: 'image.upload-selected',
        label: 'Upload Selected Image',
        category: 'Insert',
        description: 'Upload the selected local markdown image and replace it with the remote URL',
        keywords: ['picgo', 'upload image', 'selected image', 'local image'],
        focusEditorAfterRun: true,
        run: handleUploadSelectedImage,
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
    ],
    [
      activeTabIdRef,
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
      handleUploadSelectedImage,
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
    ],
  )

  const handleCommandPaletteSelect = useCallback(
    async (action: CommandPaletteAction) => {
      const didRun = await action.run()
      if (didRun === false) {
        return
      }

      closeCommandPalette()

      if (action.focusEditorAfterRun) {
        queueMicrotask(() => {
          editorRef.current?.focus()
        })
      }
    },
    [closeCommandPalette, editorRef],
  )

  return {
    commandPaletteActions,
    handleCommandPaletteSelect,
  }
}
