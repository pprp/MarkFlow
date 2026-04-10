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
import { fileUrlToPath, isMarkdownFilePath, linkDecorations, resolveLinkHref } from './decorations/linkDecoration'
import { yamlFrontMatterDecorations } from './decorations/yamlFrontMatter'
import { listDecorations } from './decorations/listDecoration'
import { mathDecorations } from './decorations/mathDecoration'
import { mermaidDecorations } from './decorations/mermaidDecoration'
import { smartInput } from './extensions/smartInput'
import { focusModeExtension, typewriterModeExtension } from './extensions/focusMode'
import { smartTypographyExtension } from './extensions/smartTypography'
import { FloatingToolbar } from '../components/FloatingToolbar'

export interface MarkFlowEditorProps {
  content: string
  viewMode: ViewMode
  onChange?: (content: string) => void
  onOpenPath?: (filePath: string) => void | Promise<unknown>
  onToggleMode?: () => void
  onSelectionChange?: (selectedText: string) => void
  onToggleFocusMode?: () => void
  onToggleTypewriterMode?: () => void
  focusMode?: boolean
  typewriterMode?: boolean
  filePath?: string
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
    linkDecorations(filePath),
    listDecorations(),
    mathDecorations(),
    mermaidDecorations(),
    yamlFrontMatterDecorations(),
  ]
}

function findRenderedLink(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const link = target.closest('a.mf-link[href]')
  return link instanceof HTMLAnchorElement ? link : null
}

function normalizeHeadingAnchor(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function findHeadingAnchorPosition(view: EditorView, href: string) {
  if (!href.startsWith('#')) {
    return null
  }

  const targetAnchor = normalizeHeadingAnchor(decodeURIComponent(href.slice(1)))
  if (!targetAnchor) {
    return null
  }

  const seenAnchors = new Map<string, number>()

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber)
    const match = line.text.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
    if (!match) {
      continue
    }

    const baseAnchor = normalizeHeadingAnchor(match[1])
    if (!baseAnchor) {
      continue
    }

    const nextIndex = seenAnchors.get(baseAnchor) ?? 0
    seenAnchors.set(baseAnchor, nextIndex + 1)

    const anchor = nextIndex === 0 ? baseAnchor : `${baseAnchor}-${nextIndex}`
    if (anchor === targetAnchor) {
      return line.from
    }
  }

  return null
}

export function MarkFlowEditor({
  content,
  viewMode,
  onChange,
  onOpenPath,
  onToggleMode,
  onSelectionChange,
  onToggleFocusMode,
  onToggleTypewriterMode,
  focusMode = false,
  typewriterMode = false,
  filePath,
}: MarkFlowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
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
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
          if (update.selectionSet || update.docChanged) {
            const sel = update.state.selection.main
            const selectedText = sel.empty ? '' : update.state.doc.sliceString(sel.from, sel.to)
            onSelectionChangeRef.current?.(selectedText)
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

      const link = findRenderedLink(event.target)
      const rawHref = link?.getAttribute('href')
      if (!rawHref) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const href = resolveLinkHref(rawHref, filePathRef.current)
      const headingPosition = findHeadingAnchorPosition(view, href)
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

    view.dom.addEventListener('click', handleClick)

    viewRef.current = view
    setEditorView(view)

    return () => {
      view.dom.removeEventListener('click', handleClick)
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

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={containerRef} className="mf-editor-container" style={{ height: '100%' }} />
      <FloatingToolbar view={editorView} />
    </div>
  )
}
