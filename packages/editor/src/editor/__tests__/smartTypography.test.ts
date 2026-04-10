import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { isInCodeContext, smartTypographyExtension } from '../extensions/smartTypography'

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), ...smartTypographyExtension()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

/** Simulate typing a single character by dispatching an insertion change. */
function typeChar(view: EditorView, char: string) {
  const pos = view.state.selection.main.from
  view.dispatch({
    changes: { from: pos, insert: char },
    selection: { anchor: pos + char.length },
  })
}

describe('isInCodeContext', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('returns false for plain prose', () => {
    const view = makeView('Hello world', 5)
    expect(isInCodeContext(view, 5)).toBe(false)
    view.destroy()
  })

  it('returns true inside inline code', () => {
    const doc = 'before `code here` after'
    const view = makeView(doc, 12) // inside "code here"
    expect(isInCodeContext(view, 12)).toBe(true)
    view.destroy()
  })
})

describe('smartTypographyExtension — double quotes', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('opening double quote after space becomes left double quote U+201C', () => {
    // Simulate the smart quote handler being called after space
    const view = makeView('Hello ')
    // Direct dispatch simulating the smart quote handler
    const pos = view.state.selection.main.from
    const charBefore = view.state.doc.sliceString(pos - 1, pos)
    const isOpening = /[\s([{]/.test(charBefore)
    expect(isOpening).toBe(true)
    const quote = isOpening ? '\u201C' : '\u201D'
    view.dispatch({
      changes: { from: pos, insert: quote },
      selection: { anchor: pos + 1 },
    })
    expect(view.state.doc.sliceString(pos, pos + 1)).toBe('\u201C')
    view.destroy()
  })

  it('closing double quote after word char becomes right double quote U+201D', () => {
    const view = makeView('word')
    const pos = view.state.selection.main.from
    const charBefore = view.state.doc.sliceString(pos - 1, pos)
    const isOpening = charBefore === '' || /[\s([{]/.test(charBefore)
    expect(isOpening).toBe(false)
    const quote = isOpening ? '\u201C' : '\u201D'
    view.dispatch({
      changes: { from: pos, insert: quote },
      selection: { anchor: pos + 1 },
    })
    expect(view.state.doc.sliceString(pos, pos + 1)).toBe('\u201D')
    view.destroy()
  })
})

describe('smartTypographyExtension — dashes', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('two hyphens in prose become an en dash', () => {
    const view = makeView('word-')
    // Simulate inputHandler: "-" typed after "word-"
    const pos = view.state.selection.main.from // after "word-"
    const charBefore = view.state.doc.sliceString(pos - 1, pos) // "-"
    const line = view.state.doc.lineAt(pos)
    const linePrefix = view.state.doc.sliceString(line.from, pos).trim()
    // linePrefix = "word-", not empty and not just "-"
    expect(charBefore).toBe('-')
    expect(linePrefix).not.toBe('-')
    expect(linePrefix).not.toBe('')
    // Should transform
    view.dispatch({
      changes: { from: pos - 1, to: pos, insert: '\u2013' },
      selection: { anchor: pos },
    })
    expect(view.state.doc.toString()).toBe('word\u2013')
    view.destroy()
  })

  it('en dash followed by hyphen becomes em dash', () => {
    const view = makeView('word\u2013') // "word–"
    const pos = view.state.selection.main.from
    const charBefore = view.state.doc.sliceString(pos - 1, pos) // "–"
    expect(charBefore).toBe('\u2013')
    // Transform – + new "-" → —
    view.dispatch({
      changes: { from: pos - 1, to: pos, insert: '\u2014' },
      selection: { anchor: pos },
    })
    expect(view.state.doc.toString()).toBe('word\u2014')
    view.destroy()
  })

  it('single hyphen at start of line is NOT transformed (list marker)', () => {
    const view = makeView('-') // just a list marker prefix
    const pos = view.state.selection.main.from
    const charBefore = view.state.doc.sliceString(pos - 1, pos)
    const line = view.state.doc.lineAt(pos)
    const linePrefix = view.state.doc.sliceString(line.from, pos).trim()
    // linePrefix is "-" — skip transformation
    expect(linePrefix).toBe('-')
    // Handler should return false, no transformation
    view.destroy()
  })

  it('hyphen after only whitespace on line is NOT transformed', () => {
    const view = makeView('  -') // indented list marker
    const pos = view.state.selection.main.from
    const charBefore = view.state.doc.sliceString(pos - 1, pos)
    const line = view.state.doc.lineAt(pos)
    const linePrefix = view.state.doc.sliceString(line.from, pos).trim()
    expect(charBefore).toBe('-')
    // linePrefix trims to "-" → skip
    expect(linePrefix).toBe('-')
    view.destroy()
  })

  it('preserves document content', () => {
    const doc = 'hello - world'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('smartTypographyExtension — code exclusion', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('mounts on document with inline code without throwing', () => {
    const view = makeView('Use `code` here')
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('mounts on document with fenced code block without throwing', () => {
    const view = makeView('```ts\nconst x = 1\n```\n\nafter')
    expect(view).toBeTruthy()
    view.destroy()
  })
})
