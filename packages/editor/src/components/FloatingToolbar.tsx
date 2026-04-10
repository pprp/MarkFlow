import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import './FloatingToolbar.css'

interface ToolbarAction {
  label: string
  title: string
  syntax: [string, string]
}

const ACTIONS: ToolbarAction[] = [
  { label: 'B', title: 'Bold (Ctrl+B)', syntax: ['**', '**'] },
  { label: 'I', title: 'Italic (Ctrl+I)', syntax: ['*', '*'] },
  { label: 'S', title: 'Strikethrough', syntax: ['~~', '~~'] },
  { label: '`', title: 'Inline Code (Ctrl+`)', syntax: ['`', '`'] },
  { label: '🔗', title: 'Link (Ctrl+K)', syntax: ['[', '](url)'] },
]

interface FloatingToolbarProps {
  view: EditorView | null
}

interface Position {
  top: number
  left: number
}

export function FloatingToolbar({ view }: FloatingToolbarProps) {
  const [pos, setPos] = useState<Position | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!view) return

    const update = () => {
      const { selection } = view.state
      const main = selection.main

      if (main.empty) {
        setPos(null)
        return
      }

      // Get screen coords of the selection start
      const coords = view.coordsAtPos(main.from)
      if (!coords) return

      const editorRect = view.dom.getBoundingClientRect()
      const TOOLBAR_HEIGHT = 40

      let top = coords.top - editorRect.top - TOOLBAR_HEIGHT - 8
      let left = coords.left - editorRect.left

      // Clamp to editor bounds
      const toolbarWidth = 220
      if (left + toolbarWidth > editorRect.width) {
        left = editorRect.width - toolbarWidth
      }
      if (top < 0) {
        // Show below the selection instead
        top = coords.bottom - editorRect.top + 8
      }

      setPos({ top, left })
    }

    view.dom.addEventListener('mouseup', update)
    const hide = () => setPos(null)
    document.addEventListener('keydown', hide)

    return () => {
      view.dom.removeEventListener('mouseup', update as never)
      document.removeEventListener('keydown', hide)
    }
  }, [view])

  function applyFormat(syntax: [string, string]) {
    if (!view) return
    const { state } = view
    const sel = state.selection.main
    if (sel.empty) return

    const selected = state.doc.sliceString(sel.from, sel.to)
    const [open, close] = syntax
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: open + selected + close },
      selection: { anchor: sel.from, head: sel.from + open.length + selected.length + close.length },
    })
    setPos(null)
    view.focus()
  }

  if (!pos) return null

  return (
    <div
      ref={toolbarRef}
      className="mf-floating-toolbar"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()} // prevent losing selection
    >
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          className="mf-toolbar-btn"
          title={action.title}
          onClick={() => applyFormat(action.syntax)}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
