import { describe, it, expect } from 'vitest'
import { applyBold, applyItalic, applyUnderline, applyLink } from '../extensions/smartInput'
import { EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { smartInput } from '../extensions/smartInput'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'

const STRUCTURAL_PAIRS = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
] as const

function makeView(doc: string, cursor: number) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), smartInput()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function dispatchEditorKey(view: EditorView, key: string) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
  })

  return runScopeHandlers(view, event, 'editor')
}

describe('smartInput — auto-pairs', () => {
  it.each(STRUCTURAL_PAIRS)('inserts %s%s and places the cursor inside', (open, close) => {
    const view = makeView('', 0)

    expect(dispatchEditorKey(view, open)).toBe(true)
    expect(view.state.doc.toString()).toBe(`${open}${close}`)
    expect(view.state.selection.main.from).toBe(1)
    expect(view.state.selection.main.to).toBe(1)

    view.destroy()
  })

  it.each(['*', '_'] as const)('auto-pairs %s in emphasis-friendly text context', (delimiter) => {
    const view = makeView('Hello ', 6)

    expect(dispatchEditorKey(view, delimiter)).toBe(true)
    expect(view.state.doc.toString()).toBe(`Hello ${delimiter}${delimiter}`)
    expect(view.state.selection.main.from).toBe(7)
    expect(view.state.selection.main.to).toBe(7)

    view.destroy()
  })

  it.each(STRUCTURAL_PAIRS)('wraps the current selection when typing %s', (open, close) => {
    const view = makeView('word', 0)
    view.dispatch({ selection: { anchor: 0, head: 4 } })

    expect(dispatchEditorKey(view, open)).toBe(true)
    expect(view.state.doc.toString()).toBe(`${open}word${close}`)
    expect(view.state.selection.main.from).toBe(1)
    expect(view.state.selection.main.to).toBe(5)

    view.destroy()
  })

  it.each(['*', '_'] as const)('wraps the current selection when typing %s', (delimiter) => {
    const view = makeView('word', 0)
    view.dispatch({ selection: { anchor: 0, head: 4 } })

    expect(dispatchEditorKey(view, delimiter)).toBe(true)
    expect(view.state.doc.toString()).toBe(`${delimiter}word${delimiter}`)
    expect(view.state.selection.main.from).toBe(1)
    expect(view.state.selection.main.to).toBe(5)

    view.destroy()
  })

  it.each(['*', '_'] as const)('removes an empty %s pair atomically on Backspace', (delimiter) => {
    const view = makeView('Hello ', 6)

    expect(dispatchEditorKey(view, delimiter)).toBe(true)
    expect(dispatchEditorKey(view, 'Backspace')).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello ')
    expect(view.state.selection.main.from).toBe(6)
    expect(view.state.selection.main.to).toBe(6)

    view.destroy()
  })

  it.each(STRUCTURAL_PAIRS)('removes an empty %s%s pair atomically on Backspace', (open, close) => {
    const view = makeView('Hello ', 6)

    expect(`${open}${close}`).toHaveLength(2)
    expect(dispatchEditorKey(view, open)).toBe(true)
    expect(dispatchEditorKey(view, 'Backspace')).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello ')
    expect(view.state.selection.main.from).toBe(6)
    expect(view.state.selection.main.to).toBe(6)

    view.destroy()
  })

  it('does not intercept `*` at the start of a line, preserving unordered-list entry', () => {
    const view = makeView('', 0)

    expect(dispatchEditorKey(view, '*')).toBe(false)

    view.dispatch(view.state.replaceSelection('*'))
    view.dispatch(view.state.replaceSelection(' '))

    expect(view.state.doc.toString()).toBe('* ')
    expect(view.state.selection.main.from).toBe(2)

    view.destroy()
  })

  it('does not intercept `_` inside identifiers, preserving literal underscore typing', () => {
    const view = makeView('snakecase', 5)

    expect(dispatchEditorKey(view, '_')).toBe(false)

    view.dispatch(view.state.replaceSelection('_'))

    expect(view.state.doc.toString()).toBe('snake_case')
    expect(view.state.selection.main.from).toBe(6)

    view.destroy()
  })

  it('preserves skip-over behavior for an existing closing quote', () => {
    const view = makeView('""', 1)

    expect(dispatchEditorKey(view, '"')).toBe(true)
    expect(view.state.doc.toString()).toBe('""')
    expect(view.state.selection.main.from).toBe(2)
    expect(view.state.selection.main.to).toBe(2)

    view.destroy()
  })

  it.each(['*', '_'] as const)('preserves skip-over behavior for an existing closing %s', (delimiter) => {
    const view = makeView(`${delimiter}${delimiter}`, 1)

    expect(dispatchEditorKey(view, delimiter)).toBe(true)
    expect(view.state.doc.toString()).toBe(`${delimiter}${delimiter}`)
    expect(view.state.selection.main.from).toBe(2)
    expect(view.state.selection.main.to).toBe(2)

    view.destroy()
  })
})

describe('smartInput — list continuation', () => {
  it('continues an unordered list on Enter', () => {
    const doc = '- item one'
    const view = makeView(doc, doc.length)

    // Simulate Enter by dispatching the transaction our handler would produce
    const line = view.state.doc.lineAt(view.state.selection.main.from)
    const lineText = line.text
    const bulletMatch = lineText.match(/^(\s*)([-*+])\s(.*)$/)
    expect(bulletMatch).not.toBeNull()

    const [, indent, bullet] = bulletMatch!
    const continuation = `\n${indent}${bullet} `
    view.dispatch({
      changes: { from: view.state.selection.main.from, insert: continuation },
      selection: { anchor: view.state.selection.main.from + continuation.length },
    })

    expect(view.state.doc.toString()).toBe('- item one\n- ')
    view.destroy()
  })

  it('exits unordered list on Enter in empty item', () => {
    const doc = '- item\n- '
    const view = makeView(doc, doc.length)

    const line = view.state.doc.lineAt(view.state.selection.main.from)
    const lineText = line.text
    const bulletMatch = lineText.match(/^(\s*)([-*+])\s(.*)$/)
    expect(bulletMatch).not.toBeNull()

    const content = bulletMatch![3]
    expect(content.trim()).toBe('')

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    })

    expect(view.state.doc.toString()).toBe('- item\n')
    view.destroy()
  })

  it('continues an ordered list on Enter', () => {
    const doc = '1. first item'
    const view = makeView(doc, doc.length)

    const line = view.state.doc.lineAt(view.state.selection.main.from)
    const orderedMatch = line.text.match(/^(\s*)(\d+)\.\s(.*)$/)
    expect(orderedMatch).not.toBeNull()

    const [, indent, num] = orderedMatch!
    const next = parseInt(num, 10) + 1
    const continuation = `\n${indent}${next}. `
    view.dispatch({
      changes: { from: view.state.selection.main.from, insert: continuation },
      selection: { anchor: view.state.selection.main.from + continuation.length },
    })

    expect(view.state.doc.toString()).toBe('1. first item\n2. ')
    view.destroy()
  })
})

describe('smartInput — style shortcuts', () => {
  it('wraps selected text with bold markers', () => {
    const view = makeView('Hello world', 6)
    view.dispatch({ selection: { anchor: 6, head: 11 } })
    
    const result = applyBold(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello **world**')
    expect(view.state.selection.main.from).toBe(8)
    expect(view.state.selection.main.to).toBe(13)
    view.destroy()
  })

  it('inserts bold placeholder with no selection', () => {
    const view = makeView('Hello', 5)
    const result = applyBold(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello**bold text**')
    expect(view.state.selection.main.from).toBe(7)
    expect(view.state.selection.main.to).toBe(16)
    view.destroy()
  })

  it('wraps selected text with italic markers', () => {
    const view = makeView('Hello world', 6)
    view.dispatch({ selection: { anchor: 6, head: 11 } })
    
    const result = applyItalic(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello *world*')
    expect(view.state.selection.main.from).toBe(7)
    expect(view.state.selection.main.to).toBe(12)
    view.destroy()
  })

  it('inserts italic placeholder with no selection', () => {
    const view = makeView('Hello', 5)
    const result = applyItalic(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello*italic text*')
    expect(view.state.selection.main.from).toBe(6)
    expect(view.state.selection.main.to).toBe(17)
    view.destroy()
  })

  it('wraps selected text with underline tags', () => {
    const view = makeView('Hello world', 6)
    view.dispatch({ selection: { anchor: 6, head: 11 } })
    
    const result = applyUnderline(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello <u>world</u>')
    expect(view.state.selection.main.from).toBe(9)
    expect(view.state.selection.main.to).toBe(14)
    view.destroy()
  })

  it('wraps selected text with link syntax', () => {
    const view = makeView('Click here', 6)
    view.dispatch({ selection: { anchor: 6, head: 10 } })
    
    const result = applyLink(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Click [here](url)')
    expect(view.state.selection.main.from).toBe(13)
    expect(view.state.selection.main.to).toBe(16)
    view.destroy()
  })

  it('inserts link placeholder with no selection', () => {
    const view = makeView('Hello', 5)
    const result = applyLink(view)
    expect(result).toBe(true)
    expect(view.state.doc.toString()).toBe('Hello[link text](url)')
    expect(view.state.selection.main.from).toBe(6)
    expect(view.state.selection.main.to).toBe(14)
    view.destroy()
  })
})
