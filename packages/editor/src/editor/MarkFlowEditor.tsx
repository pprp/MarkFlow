import { useRef, useEffect, useState } from 'react'
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
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
import type { ViewMode } from '@markflow/shared'
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
import { tocDecorations } from './decorations/tocDecoration'
import { findHeadingAnchorPosition } from './outline'
import { FloatingToolbar } from '../components/FloatingToolbar'

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

function getWysiwygExtensions(filePath?: string) {
  return [
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
}

function findRenderedLink(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const link = target.closest('a.mf-link[href]')
  return link instanceof HTMLAnchorElement ? link : null
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
  filePath,
  navigationRequest,
}: MarkFlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        baseTheme,
        history(),
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
        smartTypographyExtension(),
        smartInput(),
        smartPasteExtension(),
        headingFoldExtension(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
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
        viewModeCompartmentRef.current.of(viewMode === 'wysiwyg' ? getWysiwygExtensions(filePath) : []),
        focusModeCompartmentRef.current.of(focusMode ? focusModeExtension() : []),
        typewriterModeCompartmentRef.current.of(typewriterMode ? typewriterModeExtension() : []),
      ],
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
        viewMode === 'wysiwyg' ? getWysiwygExtensions(filePath) : [],
      ),
    })
  }, [filePath, viewMode])

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

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={containerRef} className="mf-editor-container" style={{ height: '100%' }} />
      <FloatingToolbar view={editorView} />
    </div>
  )
}
