import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { EditorView, KeyBinding, keymap } from '@codemirror/view'

const STRUCTURAL_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
}

const MARKDOWN_DELIMITER_PAIRS: Record<'*' | '_', '*' | '_'> = {
  '*': '*',
  _: '_',
}

const AUTO_CLOSE_PAIRS: Record<string, string> = {
  ...STRUCTURAL_PAIRS,
  ...MARKDOWN_DELIMITER_PAIRS,
}

const IDENTIFIER_CHAR_RE = /[A-Za-z0-9_]/

const LEADING_WHITESPACE_RE = /^(\s*)(.*)$/
const HEADING_RE = /^(\s{0,3})(#{1,6})\s+(.*)$/
const BLOCKQUOTE_RE = /^(\s*)>\s?(.*)$/
const TASK_LIST_RE = /^(\s*)([-*+])\s\[[ xX]\]\s(.*)$/
const ORDERED_LIST_RE = /^(\s*)(\d+)\.\s(.*)$/
const UNORDERED_LIST_RE = /^(\s*)([-*+])\s(?!\[[ xX]\]\s)(.*)$/

interface SmartInputOptions {
  isWysiwygMode?: () => boolean
}

/** Auto-close paired delimiters */
function handlePairInput(view: EditorView, char: string): boolean {
  const close = AUTO_CLOSE_PAIRS[char]
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

function shouldAutoPairMarkdownDelimiter(view: EditorView, char: '*' | '_'): boolean {
  const { state } = view
  const sel = state.selection.main

  if (!sel.empty) {
    return true
  }

  const nextChar = state.doc.sliceString(sel.from, sel.from + 1)
  if (nextChar === char) {
    return true
  }

  const beforeChar = state.doc.sliceString(sel.from - 1, sel.from)
  if (IDENTIFIER_CHAR_RE.test(beforeChar) || IDENTIFIER_CHAR_RE.test(nextChar)) {
    return false
  }

  if (char === '*') {
    const line = state.doc.lineAt(sel.from)
    const linePrefix = state.doc.sliceString(line.from, sel.from)

    // Preserve `* ` unordered-list entry at the start of a line or after indentation.
    if (linePrefix.trim().length === 0) {
      return false
    }
  }

  return true
}

function handleMarkdownDelimiterInput(view: EditorView, char: '*' | '_'): boolean {
  if (!shouldAutoPairMarkdownDelimiter(view, char)) {
    return false
  }

  return handlePairInput(view, char)
}

/** Smart backspace: delete pair together when cursor sits inside */
function handleBackspace(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false

  const before = state.doc.sliceString(sel.from - 1, sel.from)
  const after = state.doc.sliceString(sel.from, sel.from + 1)

  if (AUTO_CLOSE_PAIRS[before] === after) {
    view.dispatch({
      changes: { from: sel.from - 1, to: sel.from + 1 },
      selection: { anchor: sel.from - 1 },
    })
    return true
  }
  return false
}

function isPlainParagraphSelection(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false

  const tree = ensureSyntaxTree(state, sel.from, 50) ?? syntaxTree(state)
  const positions =
    state.doc.length === 0 ? [0] : Array.from(new Set([sel.from, Math.max(0, sel.from - 1)]))

  for (const position of positions) {
    let node = tree.resolveInner(position, -1)
    while (true) {
      if (node.name === 'Paragraph') {
        return node.parent?.name === 'Document'
      }

      const parent = node.parent
      if (!parent) {
        break
      }

      node = parent
    }
  }

  return false
}

function insertSelectionBreak(view: EditorView, text: string): boolean {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  return true
}

/** Continue list items on Enter, or exit empty list item */
function handleEnter(view: EditorView, options?: SmartInputOptions): boolean {
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

  if (options?.isWysiwygMode?.() && isPlainParagraphSelection(view)) {
    return insertSelectionBreak(view, '\n\n')
  }

  return false
}

function handleShiftEnter(view: EditorView, options?: SmartInputOptions): boolean {
  if (!options?.isWysiwygMode?.()) {
    return false
  }

  if (!isPlainParagraphSelection(view)) {
    return false
  }

  return insertSelectionBreak(view, '\n')
}

function replaceCurrentLine(view: EditorView, nextText: string): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)

  if (nextText === line.text) {
    return true
  }

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: nextText },
  })

  return true
}

function setCurrentLineParagraph(view: EditorView): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)

  const headingMatch = line.text.match(HEADING_RE)
  if (headingMatch) {
    return replaceCurrentLine(view, `${headingMatch[1]}${headingMatch[3]}`)
  }

  const blockquoteMatch = line.text.match(BLOCKQUOTE_RE)
  if (blockquoteMatch) {
    return replaceCurrentLine(view, `${blockquoteMatch[1]}${blockquoteMatch[2]}`)
  }

  const orderedMatch = line.text.match(ORDERED_LIST_RE)
  if (orderedMatch) {
    return replaceCurrentLine(view, `${orderedMatch[1]}${orderedMatch[3]}`)
  }

  const unorderedMatch = line.text.match(UNORDERED_LIST_RE)
  if (unorderedMatch) {
    return replaceCurrentLine(view, `${unorderedMatch[1]}${unorderedMatch[3]}`)
  }

  return true
}

function setCurrentLineHeadingLevel(view: EditorView, level: number | null): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const match = line.text.match(HEADING_RE)
  const indent = match?.[1] ?? ''
  const content = match ? match[3] : line.text

  if (level === null) {
    return setCurrentLineParagraph(view)
  }

  const nextText = level === null ? `${indent}${content}` : `${indent}${'#'.repeat(level)} ${content}`

  return replaceCurrentLine(view, nextText)
}

function adjustCurrentLineHeadingLevel(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const match = line.text.match(HEADING_RE)

  if (!match) {
    return true
  }

  const currentLevel = match[2].length

  if (direction > 0) {
    return setCurrentLineHeadingLevel(view, Math.min(currentLevel + 1, 6))
  }

  return setCurrentLineHeadingLevel(view, currentLevel === 1 ? null : currentLevel - 1)
}

function toggleCurrentLineBlock(
  view: EditorView,
  pattern: RegExp,
  getParagraphText: (match: RegExpMatchArray) => string,
  prefix: string,
): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const match = line.text.match(pattern)

  if (line.text.match(TASK_LIST_RE)) {
    return true
  }

  if (match) {
    return replaceCurrentLine(view, getParagraphText(match))
  }

  const [, indent, content] = line.text.match(LEADING_WHITESPACE_RE) ?? ['', '', line.text]
  return replaceCurrentLine(view, `${indent}${prefix}${content}`)
}

function toggleCurrentLineQuote(view: EditorView): boolean {
  return toggleCurrentLineBlock(view, BLOCKQUOTE_RE, (match) => `${match[1]}${match[2]}`, '> ')
}

function toggleCurrentLineOrderedList(view: EditorView): boolean {
  return toggleCurrentLineBlock(view, ORDERED_LIST_RE, (match) => `${match[1]}${match[3]}`, '1. ')
}

function toggleCurrentLineUnorderedList(view: EditorView): boolean {
  return toggleCurrentLineBlock(view, UNORDERED_LIST_RE, (match) => `${match[1]}${match[3]}`, '- ')
}


export function wrapSelectionOrInsert(
  view: EditorView,
  open: string,
  close: string,
  placeholder: string,
): boolean {
  const { state } = view
  const sel = state.selection.main

  if (!sel.empty) {
    // Selection exists — wrap it
    view.dispatch({
      changes: [
        { from: sel.from, insert: open },
        { from: sel.to, insert: close },
      ],
      selection: { anchor: sel.from + open.length, head: sel.to + open.length },
    })
    return true
  }

  // Collapsed selection — insert wrapper with placeholder
  const insert = open + placeholder + close
  view.dispatch({
    changes: { from: sel.from, insert },
    selection: { anchor: sel.from + open.length, head: sel.from + open.length + placeholder.length },
  })
  return true
}

export function applyBold(view: EditorView): boolean {
  return wrapSelectionOrInsert(view, '**', '**', 'bold text')
}

export function applyItalic(view: EditorView): boolean {
  return wrapSelectionOrInsert(view, '*', '*', 'italic text')
}

export function applyUnderline(view: EditorView): boolean {
  return wrapSelectionOrInsert(view, '<u>', '</u>', 'underline text')
}

export function applyLink(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main

  if (!sel.empty) {
    const text = state.doc.sliceString(sel.from, sel.to)
    const insert = `[${text}](url)`
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + text.length + 3, head: sel.from + text.length + 6 },
    })
    return true
  }

  const insert = '[link text](url)'
  view.dispatch({
    changes: { from: sel.from, insert },
    selection: { anchor: sel.from + 1, head: sel.from + 9 },
  })
  return true
}

function buildSmartInputKeymap(options?: SmartInputOptions): KeyBinding[] {
  return [
  ...Array.from({ length: 6 }, (_, index) => ({
    key: `Mod-${index + 1}`,
    preventDefault: true,
    run: (view: EditorView) => setCurrentLineHeadingLevel(view, index + 1),
  })),
  {
    key: 'Mod-0',
    preventDefault: true,
    run: (view: EditorView) => setCurrentLineHeadingLevel(view, null),
  },
  {
    key: 'Mod-=',
    preventDefault: true,
    run: (view: EditorView) => adjustCurrentLineHeadingLevel(view, 1),
  },
  {
    key: 'Mod--',
    preventDefault: true,
    run: (view: EditorView) => adjustCurrentLineHeadingLevel(view, -1),
  },
  {
    key: 'Ctrl-Shift-q',
    mac: 'Cmd-Alt-q',
    preventDefault: true,
    run: toggleCurrentLineQuote,
  },
  {
    key: 'Ctrl-Shift-[',
    mac: 'Cmd-Alt-o',
    preventDefault: true,
    run: toggleCurrentLineOrderedList,
  },
  {
    key: 'Ctrl-{',
    preventDefault: true,
    run: toggleCurrentLineOrderedList,
  },
  {
    key: 'Ctrl-Shift-]',
    mac: 'Cmd-Alt-u',
    preventDefault: true,
    run: toggleCurrentLineUnorderedList,
  },
  {
    key: 'Ctrl-}',
    preventDefault: true,
    run: toggleCurrentLineUnorderedList,
  },
  {
    key: 'Mod-b',
    preventDefault: true,
    run: applyBold,
  },
  {
    key: 'Mod-i',
    preventDefault: true,
    run: applyItalic,
  },
  {
    key: 'Mod-u',
    preventDefault: true,
    run: applyUnderline,
  },
  {
    key: 'Mod-k',
    preventDefault: true,
    run: applyLink,
  },
  {
    key: 'Shift-Enter',
    run: (view: EditorView) => handleShiftEnter(view, options),
  },
  {
    key: 'Enter',
    run: (view: EditorView) => handleEnter(view, options),
  },
  {
    key: 'Backspace',
    run: handleBackspace,
  },
  ...Object.keys(STRUCTURAL_PAIRS).map((char) => ({
    key: char,
    run: (view: EditorView) => handlePairInput(view, char),
  })),
  ...(['*', '_'] as const).map((char) => ({
    key: char,
    run: (view: EditorView) => handleMarkdownDelimiterInput(view, char),
  })),
]
}

export function smartInput(options?: SmartInputOptions) {
  return Prec.highest(keymap.of(buildSmartInputKeymap(options)))
}
