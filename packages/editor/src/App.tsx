import { useEffect, useRef, useState } from 'react'
import { MarkFlowEditor } from './editor/MarkFlowEditor'
import type { MarkFlowDocument, MarkFlowMenuAction, ViewMode } from '@markflow/shared'

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
- [ ] Build plugin system

---

Happy writing!
`

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('wysiwyg')
  const [documentState, setDocumentState] = useState<MarkFlowDocument>({
    filePath: null,
    content: INITIAL_CONTENT,
    isDirty: false,
  })
  const persistedContentRef = useRef(INITIAL_CONTENT)
  const latestContentRef = useRef(INITIAL_CONTENT)

  useEffect(() => {
    latestContentRef.current = documentState.content
  }, [documentState.content])

  useEffect(() => {
    const api = window.markflow
    if (!api) return

    const applyOpenedDocument = ({ filePath, content }: { filePath: string | null; content: string }) => {
      persistedContentRef.current = content
      latestContentRef.current = content
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

    void api.getCurrentDocument().then((currentDocument) => {
      if (currentDocument) {
        applyOpenedDocument(currentDocument)
      }
    })

    return () => {
      unsubscribeFileOpened()
      unsubscribeFileSaved()
      unsubscribeMenuAction()
    }
  }, [])

  function toggleViewMode() {
    setViewMode((m) => (m === 'wysiwyg' ? 'source' : 'wysiwyg'))
  }

  function handleContentChange(content: string) {
    latestContentRef.current = content
    setDocumentState((currentDocument) => ({
      ...currentDocument,
      content,
      isDirty: content !== persistedContentRef.current,
    }))
  }

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
          <span className="mf-titlebar-document">
            {activeDocumentName}
            {documentState.isDirty ? ' ●' : ''}
          </span>
        </div>
        <div className="mf-titlebar-right">
          <button className="mf-mode-toggle" onClick={toggleViewMode} title="Toggle view mode (Ctrl+/)">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              {viewMode === 'wysiwyg' ? (
                <>
                  <rect x="1" y="2" width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.7"/>
                  <rect x="1" y="5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="1" y="8" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="1" y="11" width="9" height="1.5" rx="0.5" fill="currentColor" opacity="0.3"/>
                </>
              ) : (
                <>
                  <text x="1" y="9" fontSize="7" fill="currentColor" fontFamily="monospace" opacity="0.8">&lt;/&gt;</text>
                </>
              )}
            </svg>
            {viewMode === 'wysiwyg' ? 'WYSIWYG' : 'Source'}
          </button>
        </div>
      </header>
      <main className="mf-main">
        <MarkFlowEditor
          content={documentState.content}
          viewMode={viewMode}
          onChange={handleContentChange}
          onToggleMode={toggleViewMode}
          filePath={documentState.filePath ?? undefined}
        />
      </main>
    </div>
  )
}
