import { EditorView, KeyBinding, keymap } from '@codemirror/view'

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
}

/** Auto-close brackets and quotes */
function handlePairInput(view: EditorView, char: string): boolean {
  const close = PAIRS[char]
  if (!close) return false

  const { state } = view
  const sel = state.selection.main

  // If there's a selection, wrap it
  if (!sel.empty) {
    view.dispatch({
      changes: [
        { from: sel.from, insert: char },
        { from: sel.to, insert: close },
      ],
      selection: { anchor: sel.from + 1, head: sel.to + 1 },
    })
    return true
  }

  // Insert pair and place cursor inside
  const nextChar = state.doc.sliceString(sel.from, sel.from + 1)
  // Don't double-insert if next char is already the closing pair
  if (nextChar === close && char === close) {
    view.dispatch({ selection: { anchor: sel.from + 1 } })
    return true
  }

  view.dispatch({
    changes: { from: sel.from, insert: char + close },
    selection: { anchor: sel.from + 1 },
  })
  return true
}

/** Smart backspace: delete pair together when cursor sits inside */
function handleBackspace(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false

  const before = state.doc.sliceString(sel.from - 1, sel.from)
  const after = state.doc.sliceString(sel.from, sel.from + 1)

  if (PAIRS[before] === after) {
    view.dispatch({
      changes: { from: sel.from - 1, to: sel.from + 1 },
      selection: { anchor: sel.from - 1 },
    })
    return true
  }
  return false
}

/** Continue list items on Enter, or exit empty list item */
function handleEnter(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false

  const line = state.doc.lineAt(sel.from)
  const lineText = line.text

  // Task list item
  const taskMatch = lineText.match(/^(\s*)([-*+])\s\[[ x]\]\s(.*)$/)
  if (taskMatch) {
    const [, indent, bullet, content] = taskMatch
    if (!content.trim()) {
      // Empty task item — exit list
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      })
      return true
    }
    const continuation = `\n${indent}${bullet} [ ] `
    view.dispatch({
      changes: { from: sel.from, insert: continuation },
      selection: { anchor: sel.from + continuation.length },
    })
    return true
  }

  // Unordered list item
  const bulletMatch = lineText.match(/^(\s*)([-*+])\s(.*)$/)
  if (bulletMatch) {
    const [, indent, bullet, content] = bulletMatch
    if (!content.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      })
      return true
    }
    const continuation = `\n${indent}${bullet} `
    view.dispatch({
      changes: { from: sel.from, insert: continuation },
      selection: { anchor: sel.from + continuation.length },
    })
    return true
  }

  // Ordered list item
  const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s(.*)$/)
  if (orderedMatch) {
    const [, indent, num, content] = orderedMatch
    if (!content.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: { anchor: line.from },
      })
      return true
    }
    const next = parseInt(num, 10) + 1
    const continuation = `\n${indent}${next}. `
    view.dispatch({
      changes: { from: sel.from, insert: continuation },
      selection: { anchor: sel.from + continuation.length },
    })
    return true
  }

  return false
}

const smartInputKeymap: KeyBinding[] = [
  {
    key: 'Enter',
    run: handleEnter,
  },
  {
    key: 'Backspace',
    run: handleBackspace,
  },
  ...Object.keys(PAIRS).map((char) => ({
    key: char,
    run: (view: EditorView) => handlePairInput(view, char),
  })),
]

export function smartInput() {
  return keymap.of(smartInputKeymap)
}
