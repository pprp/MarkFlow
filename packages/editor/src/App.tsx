import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkFlowEditor } from './editor/MarkFlowEditor'
import { extractOutlineHeadings, findActiveHeadingAnchor } from './editor/outline'
import { computeStats } from './editor/wordCount'
import { QuickOpen } from './components/QuickOpen'
import { VaultSidebar } from './components/VaultSidebar'
import { GlobalSearch } from './components/GlobalSearch'
import { createExternalLinkBadgePlugin } from './plugins/externalLinkBadgePlugin'
import {
  MarkFlowPluginHost,
  type MarkFlowQuickOpenItem,
  type MarkFlowDocument,
  type MarkFlowMenuAction,
  type MarkFlowThemePayload,
  type MarkFlowThemeSummary,
  type ViewMode,
  type SearchResult,
} from '@markflow/shared'

const THEME_STYLE_ELEMENT_ID = 'mf-theme-overrides'
const AUTO_SAVE_DELAY_MS = 30_000

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

Happy writing!
`

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('wysiwyg')
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
const [showSidebar, setShowSidebar] = useState(false)
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [vaultFiles, setVaultFiles] = useState<string[]>([])
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [themes, setThemes] = useState<MarkFlowThemeSummary[]>([])
  const [activeThemeId, setActiveThemeId] = useState<string>('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [outlineNavigationRequest, setOutlineNavigationRequest] = useState<{
    key: number
    position: number
  } | null>(null)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)
  const [selectionText, setSelectionText] = useState('')
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [quickOpenItems, setQuickOpenItems] = useState<MarkFlowQuickOpenItem[]>([])
  const [documentState, setDocumentState] = useState<MarkFlowDocument>({
    filePath: null,
    content: INITIAL_CONTENT,
    isDirty: false,
  })
  const persistedContentRef = useRef(INITIAL_CONTENT)
  const latestContentRef = useRef(INITIAL_CONTENT)
  const currentFilePathRef = useRef<string | null>(null)
  const outlineNavigationKeyRef = useRef(0)
  const pluginHostRef = useRef<MarkFlowPluginHost | null>(null)

  if (pluginHostRef.current === null) {
    pluginHostRef.current = new MarkFlowPluginHost()
    pluginHostRef.current.setPlugins([createExternalLinkBadgePlugin()])
  }

  useEffect(() => {
    latestContentRef.current = documentState.content
  }, [documentState.content])

  useEffect(() => () => {
    pluginHostRef.current?.dispose()
  }, [])

  function applyTheme(theme: MarkFlowThemePayload | null) {
    const existing = document.getElementById(THEME_STYLE_ELEMENT_ID) as HTMLStyleElement | null
    const style = existing ?? document.createElement('style')

    if (!existing) {
      style.id = THEME_STYLE_ELEMENT_ID
      document.head.appendChild(style)
    }

    style.textContent = theme?.cssText ?? ''
    setActiveThemeId(theme?.id ?? '')
  }

  useEffect(() => {
    const api = window.markflow
    if (!api) return

    const applyOpenedDocument = ({ filePath, content }: { filePath: string | null; content: string }) => {
      persistedContentRef.current = content
      latestContentRef.current = content
      setCursorPosition(0)
      setOutlineNavigationRequest(null)
      currentFilePathRef.current = filePath
      setDocumentState({
        filePath,
        content,
        isDirty: false,
      })
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
          await api.saveFile(latestContentRef.current)
          break
        case 'save-file-as':
          await api.saveFileAs(latestContentRef.current)
          break
        case 'export-html':
          await handleExport('html')
          break
        case 'export-pdf':
          await handleExport('pdf')
          break
        case 'export-docx':
        case 'export-epub':
        case 'export-latex':
          await handlePandocExport(action)
          break
      }
    }

    const unsubscribeFileOpened = api.onFileOpened(applyOpenedDocument)
    const unsubscribeFileSaved = api.onFileSaved(({ filePath }) => {
      persistedContentRef.current = latestContentRef.current
      setDocumentState((currentDocument) => ({
        ...currentDocument,
        filePath,
        isDirty: false,
      }))
    })
    const unsubscribeMenuAction = api.onMenuAction((payload) => {
      void handleMenuAction(payload)
    })
    const unsubscribeThemeUpdated = api.onThemeUpdated(applyTheme)

    void api.getCurrentDocument().then((currentDocument) => {
      if (currentDocument) {
        applyOpenedDocument(currentDocument)
      }
    })
    void api.getThemes().then(setThemes)
    void api.getCurrentTheme().then((theme) => {
      applyTheme(theme)
    })

    return () => {
      unsubscribeFileOpened()
      unsubscribeFileSaved()
      unsubscribeMenuAction()
      unsubscribeThemeUpdated()
      document.getElementById(THEME_STYLE_ELEMENT_ID)?.remove()
    }
  }, [])

  function toggleViewMode() {
    setViewMode((m) => (m === 'wysiwyg' ? 'source' : 'wysiwyg'))
  }

  function toggleFocusMode() {
    setFocusMode((v) => !v)
  }

  function toggleTypewriterMode() {
    setTypewriterMode((v) => !v)
  }

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

  const triggerAutoSave = useCallback(async () => {
    const api = window.markflow
    if (!api) return
    const { filePath, isDirty } = documentState
    if (!filePath || !isDirty) return
    await api.saveFile(latestContentRef.current)
  }, [documentState])

  useEffect(() => {
    if (!documentState.filePath || !documentState.isDirty) return
    const timer = setTimeout(() => {
      void triggerAutoSave()
    }, AUTO_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [documentState.filePath, documentState.isDirty, documentState.content, triggerAutoSave])


  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isQuickOpenKey = isMac
        ? e.metaKey && e.shiftKey && e.key.toLowerCase() === 'o'
        : e.ctrlKey && e.key.toLowerCase() === 'p'

      const isGlobalSearchKey = isMac
        ? e.metaKey && e.shiftKey && e.key.toLowerCase() === 'f'
        : e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f'

      if (isQuickOpenKey) {
        e.preventDefault()
        if (window.markflow) {
          const items = await window.markflow.getQuickOpenList()
          setQuickOpenItems(items)
          setIsQuickOpenOpen(true)
        }
      } else if (isGlobalSearchKey) {
        e.preventDefault()
        setIsGlobalSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const handleQuickOpenSelect = async (item: MarkFlowQuickOpenItem) => {
    setIsQuickOpenOpen(false)
    await handleOpenPath(item.filePath)
  }


  const handlePandocExport = async (action: 'export-docx' | 'export-epub' | 'export-latex') => {
    const api = window.markflow
    if (!api) return

    const ext = action === 'export-docx' ? 'docx' : action === 'export-epub' ? 'epub' : 'tex'
    const defaultName = currentFilePathRef.current
      ? currentFilePathRef.current.replace(/\.(md|markdown|txt)$/i, '') + '.' + ext
      : `Untitled.${ext}`

    if (action === 'export-docx') {
      await api.exportDocx(latestContentRef.current, defaultName)
    } else if (action === 'export-epub') {
      await api.exportEpub(latestContentRef.current, defaultName)
    } else {
      await api.exportLatex(latestContentRef.current, defaultName)
    }
  }

  const handleExport = async (format: 'html' | 'pdf') => {
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
  <title>${currentFilePathRef.current ? currentFilePathRef.current.split('/').pop() : 'Export'}</title>
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
    
    const defaultName = currentFilePathRef.current 
      ? currentFilePathRef.current.replace(/\.(md|markdown|txt)$/i, '') + '.' + format
      : 'Untitled.' + format

    if (format === 'html') {
      await api.exportHtml(html, defaultName)
    } else {
      await api.exportPdf(html, defaultName)
    }
  }

  function handleContentChange(content: string) {
    latestContentRef.current = content
    setDocumentState((currentDocument) => ({
      ...currentDocument,
      content,
      isDirty: content !== persistedContentRef.current,
    }))
  }

  async function handleOpenPath(filePath: string) {
    await window.markflow?.openPath(filePath)
  }

  async function handleThemeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTheme = await window.markflow?.setTheme(event.target.value)
    if (nextTheme) {
      applyTheme(nextTheme)
    }
  }

  const outlineHeadings = useMemo(
    () => extractOutlineHeadings(documentState.content),
    [documentState.content],
  )

  const activeOutlineAnchor = useMemo(
    () => findActiveHeadingAnchor(outlineHeadings, cursorPosition),
    [cursorPosition, outlineHeadings],
  )

  const handleOutlineNavigate = useCallback((position: number) => {
    outlineNavigationKeyRef.current += 1
    setOutlineNavigationRequest({
      key: outlineNavigationKeyRef.current,
      position,
    })
  }, [])

  const docStats = useMemo(
    () => computeStats(documentState.content, selectionText),
    [documentState.content, selectionText],
  )

  const activeDocumentName = documentState.filePath
    ? documentState.filePath.split(/[\\/]/).at(-1) ?? documentState.filePath
    : documentState.content === INITIAL_CONTENT && !documentState.isDirty
      ? 'Starter Document'
      : 'Untitled'

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
          {documentState.isDirty && (
            <span className="mf-titlebar-dirty-dot" aria-hidden="true" />
          )}
          <span className="mf-titlebar-document">
            {activeDocumentName}
          </span>
        </div>
        <div className="mf-titlebar-right">
          {themes.length > 0 ? (
            <select className="mf-theme-select" value={activeThemeId} onChange={handleThemeChange} aria-label="Theme">
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className={`mf-mode-toggle${typewriterMode ? ' mf-mode-active' : ''}`}
            onClick={toggleTypewriterMode}
            title="Typewriter mode (Ctrl+Shift+T)"
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
              aria-pressed={viewMode === 'reading'}
            >
              Reading
            </button>
            <button
              className={`mf-segment-btn${viewMode === 'split' ? ' mf-segment-active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Split view"
              aria-pressed={viewMode === 'split'}
            >
              Split
            </button>
          </div>
        </div>
      </header>
      <main className="mf-main">
        {showSidebar && (
          <div className="mf-sidebar">
            <VaultSidebar
              folderPath={vaultPath}
              files={vaultFiles}
              activeFile={documentState.filePath}
              onFileOpen={(fp) => void handleOpenPath(fp)}
              onFileRename={(old, newName) => void handleVaultFileRename(old, newName)}
              onFileDelete={(fp) => void handleVaultFileDelete(fp)}
              onOpenFolder={() => void handleOpenFolder()}
            />
          </div>
        )}
        <div className="mf-body">
        <div className="mf-editor-shell">
          <MarkFlowEditor
            content={documentState.content}
            viewMode={viewMode}
            onChange={handleContentChange}
            onCursorPositionChange={setCursorPosition}
            onNavigationHandled={() => setOutlineNavigationRequest(null)}
            onOpenPath={handleOpenPath}
            onToggleMode={toggleViewMode}
            onSelectionChange={setSelectionText}
            onToggleFocusMode={toggleFocusMode}
            onToggleTypewriterMode={toggleTypewriterMode}
            focusMode={focusMode}
            typewriterMode={typewriterMode}
pluginHost={pluginHostRef.current ?? undefined}
            filePath={documentState.filePath ?? undefined}
            navigationRequest={outlineNavigationRequest}
          />
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

      {isExporting && (
        <div id="mf-export-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', height: 'auto' }}>
          <MarkFlowEditor
            content={documentState.content}
            viewMode="wysiwyg"
            onChange={() => {}}
            onCursorPositionChange={() => {}}
            onNavigationHandled={() => {}}
            onOpenPath={async () => {}}
            onToggleMode={() => {}}
            onSelectionChange={() => {}}
            onToggleFocusMode={() => {}}
            onToggleTypewriterMode={() => {}}
            focusMode={false}
            typewriterMode={false}
            pluginHost={pluginHostRef.current ?? undefined}
            filePath={documentState.filePath ?? undefined}
            navigationRequest={null}
          />
        </div>
      )}
    </div>
  )
}
