import { useRef, useEffect, useState, useCallback } from 'react'
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, undoDepth } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  type MarkFlowPluginHost,
  type MarkFlowRenderedViewMode,
  type ViewMode,
} from '@markflow/shared'
import { wysiwygDecorations } from './decorations/inlineDecorations'
import { codeBlockDecorations } from './decorations/codeBlockDecoration'
import { blockquoteDecorations } from './decorations/blockquoteDecoration'
import { footnoteDecorations } from './decorations/footnoteDecoration'
import { fileUrlToPath, isMarkdownFilePath, linkDecorations, resolveLinkHref } from './decorations/linkDecoration'
import { yamlFrontMatterDecorations } from './decorations/yamlFrontMatter'
import { listDecorations } from './decorations/listDecoration'
import { mathDecorations } from './decorations/mathDecoration'
import { mermaidDecorations } from './decorations/mermaidDecoration'
import { tableDecorations } from './decorations/tableDecoration'
import { inlineHtmlDecorations } from './decorations/inlineHtmlDecoration'
import { smartInput } from './extensions/smartInput'
import { focusModeExtension, typewriterModeExtension } from './extensions/focusMode'
import { smartTypographyExtension } from './extensions/smartTypography'
import { headingFoldExtension } from './extensions/headingFold'
import { smartPasteExtension } from './extensions/smartPaste'
import { spellCheckExtension } from './extensions/spellCheck'
import { markdownPostProcessorExtension } from './extensions/markdownPostProcessor'
import { readingModeExtension } from './extensions/readingMode'
import { tocDecorations } from './decorations/tocDecoration'
import { findHeadingAnchorPosition } from './outline'
import { FloatingToolbar } from '../components/FloatingToolbar'
import { MAX_UNDO_HISTORY_EVENTS, pruneHistoryState } from './historyLimit'

export interface MarkFlowEditorProps {
  content: string
  viewMode: ViewMode
  onChange?: (content: string) => void
  onCursorPositionChange?: (position: number) => void
  onNavigationHandled?: () => void
  onOpenPath?: (filePath: string) => void | Promise<unknown>
  onToggleMode?: () => void
  onSelectionChange?: (selectedText: string) => void
  onToggleFocusMode?: () => void
  onToggleTypewriterMode?: () => void
  focusMode?: boolean
  typewriterMode?: boolean
  pluginHost?: MarkFlowPluginHost
  filePath?: string
  navigationRequest?: { key: number; position: number } | null
}

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
})

function getRenderedExtensions(
  renderedViewMode: MarkFlowRenderedViewMode,
  filePath?: string,
  pluginHost?: MarkFlowPluginHost,
) {
  const extensions = [
    wysiwygDecorations(),
    codeBlockDecorations(),
    blockquoteDecorations(),
    footnoteDecorations(),
    linkDecorations(filePath),
    listDecorations(),
    mathDecorations(),
    mermaidDecorations(),
    yamlFrontMatterDecorations(),
    tableDecorations(),
    inlineHtmlDecorations(),
    tocDecorations(),
  ]

  if (pluginHost) {
    extensions.push(
      markdownPostProcessorExtension({
        pluginHost,
        filePath,
        viewMode: renderedViewMode,
      }),
    )
  }

  return extensions
}

function findRenderedLink(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const link = target.closest('a.mf-link[href]')
  return link instanceof HTMLAnchorElement ? link : null
}

function getViewModeExtensions(viewMode: ViewMode, filePath?: string, pluginHost?: MarkFlowPluginHost) {
  if (viewMode === 'wysiwyg') {
    return getRenderedExtensions('wysiwyg', filePath, pluginHost)
  }

  if (viewMode === 'reading') {
    return [...getRenderedExtensions('reading', filePath, pluginHost), ...readingModeExtension()]
  }

  return []
}

function getEditorExtensions(
  viewMode: ViewMode,
  focusMode: boolean,
  typewriterMode: boolean,
  filePath: string | undefined,
  pluginHost: MarkFlowPluginHost | undefined,
  onChangeRef: React.MutableRefObject<MarkFlowEditorProps['onChange']>,
  onCursorPositionChangeRef: React.MutableRefObject<MarkFlowEditorProps['onCursorPositionChange']>,
  onSelectionChangeRef: React.MutableRefObject<MarkFlowEditorProps['onSelectionChange']>,
  onToggleModeRef: React.MutableRefObject<MarkFlowEditorProps['onToggleMode']>,
  onToggleFocusModeRef: React.MutableRefObject<MarkFlowEditorProps['onToggleFocusMode']>,
  onToggleTypewriterModeRef: React.MutableRefObject<MarkFlowEditorProps['onToggleTypewriterMode']>,
  pruneHistoryRef: React.MutableRefObject<((view: EditorView) => void) | null>,
  viewModeCompartment: Compartment,
  focusModeCompartment: Compartment,
  typewriterModeCompartment: Compartment,
) {
  return [
    baseTheme,
    EditorState.allowMultipleSelections.of(true),
    history({ minDepth: MAX_UNDO_HISTORY_EVENTS, newGroupDelay: 500 }),
    drawSelection(),
    highlightActiveLine(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([
      {
        key: 'Escape',
        preventDefault: true,
        run: (view) => {
          const main = view.state.selection.main
          if (view.state.selection.ranges.length <= 1) {
            return false
          }

          view.dispatch({
            selection: EditorSelection.cursor(main.head),
          })
          return true
        },
      },
      {
        key: 'Mod-/',
        preventDefault: true,
        run: () => {
          onToggleModeRef.current?.()
          return true
        },
      },
      {
        key: 'Mod-Shift-f',
        preventDefault: true,
        run: () => {
          onToggleFocusModeRef.current?.()
          return true
        },
      },
      {
        key: 'Mod-Shift-t',
        preventDefault: true,
        run: () => {
          onToggleTypewriterModeRef.current?.()
          return true
        },
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...closeBracketsKeymap,
      indentWithTab,
    ]),
    EditorView.clickAddsSelectionRange.of((event) => event.altKey),
    smartTypographyExtension(),
    smartInput(),
    smartPasteExtension(),
    headingFoldExtension(),
    spellCheckExtension(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString())
        pruneHistoryRef.current?.(update.view)
      }
      if (update.selectionSet || update.docChanged) {
        const selection = update.state.selection.main
        const selectedText = selection.empty
          ? ''
          : update.state.doc.sliceString(selection.from, selection.to)
        onSelectionChangeRef.current?.(selectedText)
        onCursorPositionChangeRef.current?.(selection.head)
      }
    }),
    viewModeCompartment.of(getViewModeExtensions(viewMode, filePath, pluginHost)),
    focusModeCompartment.of(focusMode ? focusModeExtension() : []),
    typewriterModeCompartment.of(typewriterMode ? typewriterModeExtension() : []),
  ]
}

export function MarkFlowEditor({
  content,
  viewMode,
  onChange,
  onCursorPositionChange,
  onNavigationHandled,
  onOpenPath,
  onToggleMode,
  onSelectionChange,
  onToggleFocusMode,
  onToggleTypewriterMode,
  focusMode = false,
  typewriterMode = false,
  pluginHost,
  filePath,
  navigationRequest,
}: MarkFlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewViewRef = useRef<EditorView | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onCursorPositionChangeRef = useRef(onCursorPositionChange)
  const onNavigationHandledRef = useRef(onNavigationHandled)
  const onOpenPathRef = useRef(onOpenPath)
  const onToggleModeRef = useRef(onToggleMode)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onToggleFocusModeRef = useRef(onToggleFocusMode)
  const onToggleTypewriterModeRef = useRef(onToggleTypewriterMode)
  const filePathRef = useRef(filePath)
  const pruneHistoryRef = useRef<((view: EditorView) => void) | null>(null)
  const viewModeCompartmentRef = useRef(new Compartment())
  const focusModeCompartmentRef = useRef(new Compartment())
  const typewriterModeCompartmentRef = useRef(new Compartment())
  const [editorView, setEditorView] = useState<EditorView | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onCursorPositionChangeRef.current = onCursorPositionChange
  }, [onCursorPositionChange])

  useEffect(() => {
    onNavigationHandledRef.current = onNavigationHandled
  }, [onNavigationHandled])

  useEffect(() => {
    onOpenPathRef.current = onOpenPath
  }, [onOpenPath])

  useEffect(() => {
    onToggleModeRef.current = onToggleMode
  }, [onToggleMode])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useEffect(() => {
    onToggleFocusModeRef.current = onToggleFocusMode
  }, [onToggleFocusMode])

  useEffect(() => {
    onToggleTypewriterModeRef.current = onToggleTypewriterMode
  }, [onToggleTypewriterMode])

  useEffect(() => {
    filePathRef.current = filePath
  }, [filePath])

  pruneHistoryRef.current = (view: EditorView) => {
    if (undoDepth(view.state) <= MAX_UNDO_HISTORY_EVENTS) {
      return
    }

    const nextExtensions = getEditorExtensions(
      viewMode,
      focusMode,
      typewriterMode,
      filePathRef.current,
      pluginHost,
      onChangeRef,
      onCursorPositionChangeRef,
      onSelectionChangeRef,
      onToggleModeRef,
      onToggleFocusModeRef,
      onToggleTypewriterModeRef,
      pruneHistoryRef,
      viewModeCompartmentRef.current,
      focusModeCompartmentRef.current,
      typewriterModeCompartmentRef.current,
    )
    const nextState = pruneHistoryState(view.state, nextExtensions)
    if (nextState !== view.state) {
      view.setState(nextState)
    }
  }

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: getEditorExtensions(
        viewMode,
        focusMode,
        typewriterMode,
        filePath,
        pluginHost,
        onChangeRef,
        onCursorPositionChangeRef,
        onSelectionChangeRef,
        onToggleModeRef,
        onToggleFocusModeRef,
        onToggleTypewriterModeRef,
        pruneHistoryRef,
        viewModeCompartmentRef.current,
        focusModeCompartmentRef.current,
        typewriterModeCompartmentRef.current,
      ),
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    const handleClick = (event: MouseEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }

      // Handle wikilink clicks (MF-040)
      const wikilinkTarget = (event.target instanceof Element)
        ? event.target.closest('[data-wikilink]')
        : null
      if (wikilinkTarget instanceof HTMLElement) {
        const wikilinkFile = wikilinkTarget.dataset.wikilink
        if (wikilinkFile && onOpenPathRef.current) {
          event.preventDefault()
          event.stopPropagation()
          void onOpenPathRef.current(wikilinkFile)
          return
        }
      }

      const link = findRenderedLink(event.target)
      const rawHref = link?.getAttribute('href')
      if (!rawHref) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const href = resolveLinkHref(rawHref, filePathRef.current)
      const headingPosition = findHeadingAnchorPosition(view.state.doc.toString(), href)
      if (headingPosition !== null) {
        view.dispatch({
          selection: EditorSelection.cursor(headingPosition),
          effects: EditorView.scrollIntoView(headingPosition, { y: 'start' }),
        })
        view.focus()
        return
      }

      const localPath = fileUrlToPath(href)
      if (localPath && isMarkdownFilePath(localPath) && onOpenPathRef.current) {
        void onOpenPathRef.current(localPath)
        return
      }

      window.open(href, '_blank', 'noopener,noreferrer')
    }

    // Drag-and-drop handler for images and markdown files (MF-029)
    const handleDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return

      let handled = false
      for (const file of Array.from(files)) {
        if (file.type.startsWith('image/')) {
          event.preventDefault()
          handled = true
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.doc.length
          const fileName = file.name
          view.dispatch({
            changes: { from: pos, to: pos, insert: `![${fileName}](./${fileName})` },
            selection: { anchor: pos + `![${fileName}](./${fileName})`.length },
          })
          // Fire custom event for desktop layer
          view.dom.dispatchEvent(
            new CustomEvent('mf-image-drop', {
              detail: { file },
              bubbles: true,
              composed: true,
            }),
          )
          break
        }
      }

      if (!handled) {
        for (const file of Array.from(files)) {
          const filePath = (file as File & { path?: string }).path ?? file.name
          if (isMarkdownFilePath(filePath) && onOpenPathRef.current) {
            event.preventDefault()
            void onOpenPathRef.current(filePath)
            break
          }
        }
      }
    }

    view.dom.addEventListener('click', handleClick)
    view.dom.addEventListener('drop', handleDrop)

    viewRef.current = view
    setEditorView(view)
    onCursorPositionChangeRef.current?.(view.state.selection.main.head)

    return () => {
      view.dom.removeEventListener('click', handleClick)
      view.dom.removeEventListener('drop', handleDrop)
      view.destroy()
      viewRef.current = null
      setEditorView(null)
    }
    // Initial editor creation happens once; content and mode changes are
    // handled by dedicated effects below so the EditorView can persist.
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    view.dispatch({
      effects: viewModeCompartmentRef.current.reconfigure(
        getViewModeExtensions(viewMode, filePath, pluginHost),
      ),
    })
  }, [filePath, pluginHost, viewMode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: focusModeCompartmentRef.current.reconfigure(
        focusMode ? focusModeExtension() : [],
      ),
    })
  }, [focusMode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: typewriterModeCompartmentRef.current.reconfigure(
        typewriterMode ? typewriterModeExtension() : [],
      ),
    })
  }, [typewriterMode])

  // Split view: create/destroy the preview pane
  useEffect(() => {
    if (viewMode !== 'split') {
      // Destroy preview pane when leaving split mode
      if (previewViewRef.current) {
        previewViewRef.current.destroy()
        previewViewRef.current = null
      }
      return
    }

    if (!previewContainerRef.current) return

    const previewState = EditorState.create({
      doc: content,
      extensions: [
        baseTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.editable.of(false),
        EditorView.lineWrapping,
        ...getRenderedExtensions('split-preview', filePath, pluginHost),
      ],
    })

    const previewView = new EditorView({
      state: previewState,
      parent: previewContainerRef.current,
    })

    previewViewRef.current = previewView

    // Synchronize scroll position between source and preview
    const sourceView = viewRef.current
    if (sourceView) {
      let isSyncingLeft = false
      let isSyncingRight = false

      const handleSourceScroll = () => {
        if (!previewViewRef.current || isSyncingLeft) return
        isSyncingRight = true
        
        const sourceScroll = sourceView.scrollDOM
        const previewScroll = previewViewRef.current.scrollDOM
        
        const sourceRange = sourceScroll.scrollHeight - sourceScroll.clientHeight
        const previewRange = previewScroll.scrollHeight - previewScroll.clientHeight
        
        if (sourceRange > 0 && previewRange > 0) {
          const percentage = sourceScroll.scrollTop / sourceRange
          previewScroll.scrollTop = percentage * previewRange
        }
        
        // Reset flag after a short delay to allow the scroll event to fire and be ignored
        requestAnimationFrame(() => {
          isSyncingRight = false
        })
      }

      const handlePreviewScroll = () => {
        if (!viewRef.current || isSyncingRight) return
        isSyncingLeft = true
        
        const sourceScroll = viewRef.current.scrollDOM
        const previewScroll = previewView.scrollDOM
        
        const sourceRange = sourceScroll.scrollHeight - sourceScroll.clientHeight
        const previewRange = previewScroll.scrollHeight - previewScroll.clientHeight
        
        if (sourceRange > 0 && previewRange > 0) {
          const percentage = previewScroll.scrollTop / previewRange
          sourceScroll.scrollTop = percentage * sourceRange
        }
        
        requestAnimationFrame(() => {
          isSyncingLeft = false
        })
      }

      sourceView.scrollDOM.addEventListener('scroll', handleSourceScroll)
      previewView.scrollDOM.addEventListener('scroll', handlePreviewScroll)

      // Initial sync
      handleSourceScroll()

      return () => {
        sourceView.scrollDOM.removeEventListener('scroll', handleSourceScroll)
        previewView.scrollDOM.removeEventListener('scroll', handlePreviewScroll)
        previewView.destroy()
        previewViewRef.current = null
      }
    }

    return () => {
      previewView.destroy()
      previewViewRef.current = null
    }
  }, [filePath, pluginHost, viewMode])

  // Keep split preview in sync with content changes
  useEffect(() => {
    const previewView = previewViewRef.current
    if (!previewView || viewMode !== 'split') return

    const currentContent = previewView.state.doc.toString()
    if (content === currentContent) return

    previewView.dispatch({
      changes: { from: 0, to: currentContent.length, insert: content },
      annotations: Transaction.addToHistory.of(false),
    })
  }, [content, viewMode])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentContent = view.state.doc.toString()
    if (content === currentContent) return

    view.dispatch({
      changes: { from: 0, to: currentContent.length, insert: content },
      selection: EditorSelection.cursor(0),
      annotations: Transaction.addToHistory.of(false),
    })
  }, [content])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !navigationRequest) return

    view.dispatch({
      selection: EditorSelection.cursor(navigationRequest.position),
      effects: EditorView.scrollIntoView(navigationRequest.position, { y: 'start' }),
    })
    view.focus()
    onNavigationHandledRef.current?.()
  }, [navigationRequest])

  const [splitRatio, setSplitRatio] = useState(0.5)
  const isDraggingRef = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !splitContainerRef.current) return
    const rect = splitContainerRef.current.getBoundingClientRect()
    let newRatio = (e.clientX - rect.left) / rect.width
    // Keep it reasonable (between 10% and 90%)
    if (newRatio < 0.1) newRatio = 0.1
    if (newRatio > 0.9) newRatio = 0.9
    setSplitRatio(newRatio)
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  if (viewMode === 'split') {
    return (
      <div className="mf-split-container" ref={splitContainerRef}>
        <div className="mf-split-pane" style={{ flex: splitRatio }}>
          <div ref={containerRef} className="mf-editor-container" style={{ height: '100%' }} />
          <FloatingToolbar view={editorView} />
        </div>
        <div 
          className="mf-split-divider" 
          aria-hidden="true" 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="mf-split-pane" style={{ flex: 1 - splitRatio }}>
          <div ref={previewContainerRef} className="mf-editor-container" style={{ height: '100%' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={containerRef} className="mf-editor-container" style={{ height: '100%' }} />
      <FloatingToolbar view={editorView} />
    </div>
  )
}
