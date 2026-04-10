import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { wysiwygDecorations } from '../decorations/inlineDecorations'

function makeView(doc: string, cursorOffset = 0) {
  // cursor at doc.length + cursorOffset (clamped to valid range)
  const cursor = Math.max(0, Math.min(doc.length, doc.length + cursorOffset))
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      drawSelection(),
      wysiwygDecorations(),
      EditorView.lineWrapping,
    ],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

describe('wysiwygDecorations — headings', () => {
  it('mounts without throwing for an h1 heading', () => {
    const view = makeView('# Hello World')
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('heading line has correct text (doc unchanged)', () => {
    const doc = '# Hello World\n\nSome other text'
    const view = makeView(doc) // cursor at end, away from heading
    expect(view.state.doc.line(1).text).toBe('# Hello World')
    view.destroy()
  })

  it('handles h2 without crashing', () => {
    const view = makeView('## Section Title')
    expect(view.state.doc.line(1).text).toBe('## Section Title')
    view.destroy()
  })

  it('handles cursor inside heading without crashing', () => {
    const doc = '# Hello'
    // cursor inside the heading line
    const state = EditorState.create({
      doc,
      selection: { anchor: 3 },
      extensions: [
        markdown({ base: markdownLanguage }),
        wysiwygDecorations(),
      ],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    expect(view).toBeTruthy()
    view.destroy()
  })
})

describe('wysiwygDecorations — bold / italic', () => {
  it('handles bold markers without crashing', () => {
    const view = makeView('This is **bold** text')
    expect(view.state.doc.toString()).toContain('**bold**')
    view.destroy()
  })

  it('handles italic markers without crashing', () => {
    const view = makeView('This is *italic* text')
    expect(view.state.doc.toString()).toContain('*italic*')
    view.destroy()
  })

  it('handles inline code without crashing', () => {
    const view = makeView('Use `const` keyword')
    expect(view.state.doc.toString()).toContain('`const`')
    view.destroy()
  })

  it('handles strikethrough without crashing', () => {
    const view = makeView('This is ~~deleted~~ text')
    expect(view.state.doc.toString()).toContain('~~deleted~~')
    view.destroy()
  })

  it('handles mixed inline marks without crashing', () => {
    const doc = '**bold**, *italic*, `code`, ~~strike~~'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('handles cursor inside bold (no hide)', () => {
    const doc = 'Some **bold** text'
    const state = EditorState.create({
      doc,
      selection: { anchor: 8 }, // cursor inside **bold**
      extensions: [markdown({ base: markdownLanguage }), wysiwygDecorations()],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    expect(view).toBeTruthy()
    view.destroy()
  })
})
