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

function lineText(view: EditorView, index: number) {
  const line = view.dom.querySelectorAll('.cm-line').item(index)
  return line?.textContent ?? ''
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

describe('wysiwygDecorations — headings', () => {
  it('mounts without throwing for an h1 heading', () => {
    const view = makeView('# Hello World')
    expect(view).toBeTruthy()
    destroyView(view)
  })

  it('heading line has correct text (doc unchanged)', () => {
    const doc = '# Hello World\n\nSome other text'
    const view = makeView(doc) // cursor at end, away from heading
    expect(view.state.doc.line(1).text).toBe('# Hello World')
    destroyView(view)
  })

  it('handles h2 without crashing', () => {
    const view = makeView('## Section Title')
    expect(view.state.doc.line(1).text).toBe('## Section Title')
    destroyView(view)
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
    destroyView(view)
  })
})

describe('wysiwygDecorations — bold / italic', () => {
  it('handles bold markers without crashing', () => {
    const view = makeView('This is **bold** text')
    expect(view.state.doc.toString()).toContain('**bold**')
    destroyView(view)
  })

  it('handles italic markers without crashing', () => {
    const view = makeView('This is *italic* text')
    expect(view.state.doc.toString()).toContain('*italic*')
    destroyView(view)
  })

  it('handles inline code without crashing', () => {
    const view = makeView('Use `const` keyword')
    expect(view.state.doc.toString()).toContain('`const`')
    destroyView(view)
  })

  it('handles strikethrough without crashing', () => {
    const view = makeView('This is ~~deleted~~ text')
    expect(view.state.doc.toString()).toContain('~~deleted~~')
    destroyView(view)
  })

  it('handles mixed inline marks without crashing', () => {
    const doc = '**bold**, *italic*, `code`, ~~strike~~'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    destroyView(view)
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
    destroyView(view)
  })
})

describe('wysiwygDecorations — highlights', () => {
  it('hides highlight delimiters and applies inline styling away from the caret', () => {
    const doc = 'Use ==important== text'
    const view = makeView(doc)

    const highlight = view.dom.querySelector('.mf-highlight')
    expect(highlight?.textContent).toBe('important')
    expect(lineText(view, 0)).toBe('Use important text')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('reveals raw highlight markdown when the caret enters the span and restores styling after leaving', () => {
    const doc = 'Use ==important== text'
    const view = makeView(doc)

    view.dispatch({ selection: { anchor: doc.indexOf('important') } })

    expect(view.dom.querySelector('.mf-highlight')).toBeNull()
    expect(lineText(view, 0)).toContain('==important==')
    expect(view.state.doc.toString()).toBe(doc)

    view.dispatch({ selection: { anchor: doc.length } })

    expect(view.dom.querySelector('.mf-highlight')?.textContent).toBe('important')
    expect(lineText(view, 0)).toBe('Use important text')

    destroyView(view)
  })

  it('treats a caret at the closing boundary as outside the highlight span', () => {
    const doc = '==omega=='
    const view = makeView(doc)

    expect(view.dom.querySelector('.mf-highlight')?.textContent).toBe('omega')
    expect(lineText(view, 0)).toBe('omega')

    destroyView(view)
  })

  it('keeps highlight syntax raw inside inline code and fenced code blocks', () => {
    const doc = ['Use `==literal==` and ==real==', '', '```', '==block==', '```'].join('\n')
    const view = makeView(doc)

    expect(view.dom.querySelectorAll('.mf-highlight')).toHaveLength(1)
    expect(view.dom.querySelector('.mf-highlight')?.textContent).toBe('real')
    expect(view.dom.querySelector('.mf-inline-code')?.textContent).toBe('==literal==')
    expect(lineText(view, 3)).toContain('==block==')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('still decorates a later highlight when inline code contains a stray opening == marker', () => {
    const doc = 'Use `==literal` and ==real== text'
    const view = makeView(doc)

    expect(view.dom.querySelectorAll('.mf-highlight')).toHaveLength(1)
    expect(view.dom.querySelector('.mf-highlight')?.textContent).toBe('real')
    expect(view.dom.querySelector('.mf-inline-code')?.textContent).toBe('==literal')
    expect(lineText(view, 0)).toBe('Use ==literal and real text')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('stays compatible with neighboring bold and italic spans', () => {
    const doc = '==important== **bold** and *italic* text'
    const view = makeView(doc)

    expect(view.dom.querySelector('.mf-highlight')?.textContent).toBe('important')
    expect(view.dom.querySelector('.mf-bold')?.textContent).toBe('bold')
    expect(view.dom.querySelector('.mf-italic')?.textContent).toBe('italic')
    expect(lineText(view, 0)).toBe('important bold and italic text')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })
})
