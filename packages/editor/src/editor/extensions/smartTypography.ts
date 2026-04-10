import { EditorView, keymap } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

/**
 * Returns true when the cursor position falls inside a code span or fenced
 * code block, so typography transformations can be skipped there.
 */
export function isInCodeContext(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state)
  let inCode = false
  tree.iterate({
    enter(node) {
      if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'Code') {
        if (node.from <= pos && pos <= node.to) {
          inCode = true
        }
      }
    },
  })
  return inCode
}

/**
 * Keymap handler for `"`.  Inserts a left or right typographic double-quote
 * depending on the character preceding the cursor.  In code contexts the
 * handler returns false so the existing auto-pair extension can run instead.
 */
function handleSmartDoubleQuote(view: EditorView): boolean {
  const sel = view.state.selection.main
  if (!sel.empty) return false

  const pos = sel.from
  if (isInCodeContext(view, pos)) return false

  const charBefore = pos > 0 ? view.state.doc.sliceString(pos - 1, pos) : ''
  // Opening quote after: start of doc, whitespace, or opening bracket
  const useOpening = charBefore === '' || /[\s([{]/.test(charBefore)
  const quote = useOpening ? '\u201C' : '\u201D'

  view.dispatch({
    changes: { from: pos, insert: quote },
    selection: { anchor: pos + quote.length },
  })
  return true
}

/**
 * Input handler for `-`.  Converts:
 *   preceding `-`  → replaces the pair with `–` (en dash, U+2013)
 *   preceding `–`  → replaces the pair with `—` (em dash, U+2014)
 *
 * Skips the conversion when:
 *   - the cursor is inside a code span or fenced block
 *   - the line is blank except for dashes (would form a horizontal rule or list marker)
 */
function handleDashInput(view: EditorView, from: number, _to: number, text: string): boolean {
  if (text !== '-') return false
  if (isInCodeContext(view, from)) return false

  const charBefore = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''

  // Don't transform if the line so far consists only of dashes/whitespace
  // (i.e., this would be forming a horizontal rule or list marker)
  const line = view.state.doc.lineAt(from)
  const linePrefix = view.state.doc.sliceString(line.from, from).trim()

  if (charBefore === '\u2013') {
    // Preceding en dash + new '-' → em dash (handles sequential --- typing)
    view.dispatch({
      changes: { from: from - 1, to: from, insert: '\u2014' },
      selection: { anchor: from },
    })
    return true
  }

  if (charBefore === '-' && linePrefix !== '-' && linePrefix !== '') {
    // Two hyphens in the middle of prose → en dash
    view.dispatch({
      changes: { from: from - 1, to: from, insert: '\u2013' },
      selection: { anchor: from },
    })
    return true
  }

  return false
}

export function smartTypographyExtension() {
  return [
    keymap.of([
      {
        key: '"',
        run: handleSmartDoubleQuote,
      },
    ]),
    EditorView.inputHandler.of(handleDashInput),
  ]
}
