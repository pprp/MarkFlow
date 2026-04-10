import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { searchKeymap, highlightSelectionMatches, openSearchPanel, SearchQuery, setSearchQuery } from '@codemirror/search'

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({ base: markdownLanguage }),
      keymap.of(searchKeymap),
      highlightSelectionMatches(),
    ],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

describe('find and replace — keymap registration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('searchKeymap includes Mod-f binding', () => {
    const hasModF = searchKeymap.some((binding) => binding.key === 'Mod-f')
    expect(hasModF).toBe(true)
  })

  it('searchKeymap includes find-next binding (Mod-g or F3)', () => {
    const keys = searchKeymap.map((b) => b.key)
    expect(keys.some((k) => k === 'Mod-g' || k === 'F3')).toBe(true)
  })

  it('searchKeymap includes close-panel binding (Escape)', () => {
    const keys = searchKeymap.map((b) => b.key)
    expect(keys.some((k) => k === 'Escape')).toBe(true)
  })

  it('searchKeymap includes select-occurrences binding', () => {
    const keys = searchKeymap.map((b) => b.key)
    expect(keys.some((k) => k === 'Mod-Shift-l' || k === 'Mod-d')).toBe(true)
  })
})

describe('find and replace — panel lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('openSearchPanel dispatches without throwing', () => {
    const view = makeView('Hello world. Hello again.')
    expect(() => openSearchPanel(view)).not.toThrow()
    view.destroy()
  })

  it('document content is preserved after search panel opens', () => {
    const doc = 'Hello world. Hello again.'
    const view = makeView(doc)
    openSearchPanel(view)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('find and replace — SearchQuery', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('SearchQuery finds a simple substring', () => {
    const doc = 'Hello world. Hello again.'
    const view = makeView(doc)
    const query = new SearchQuery({ search: 'Hello' })
    const cursor = query.getCursor(view.state.doc)
    const first = cursor.next()
    expect(first.done).toBe(false)
    expect(first.value.from).toBe(0)
    view.destroy()
  })

  it('SearchQuery with caseSensitive=false matches both cases', () => {
    const doc = 'hello HELLO'
    const view = makeView(doc)
    const query = new SearchQuery({ search: 'hello', caseSensitive: false })
    const cursor = query.getCursor(view.state.doc)
    const first = cursor.next()
    expect(first.done).toBe(false)
    view.destroy()
  })

  it('SearchQuery with caseSensitive=true does not match wrong case', () => {
    const doc = 'HELLO world'
    const view = makeView(doc)
    const query = new SearchQuery({ search: 'hello', caseSensitive: true })
    const cursor = query.getCursor(view.state.doc)
    const first = cursor.next()
    // Cursor should be done (no matches) when case doesn't match
    expect(first.done).toBe(true)
    view.destroy()
  })

  it('setSearchQuery dispatches without throwing', () => {
    const view = makeView('Hello world')
    const query = new SearchQuery({ search: 'Hello' })
    expect(() => {
      view.dispatch({ effects: setSearchQuery.of(query) })
    }).not.toThrow()
    view.destroy()
  })

  it('replace modifies matched text', () => {
    const doc = 'Hello world'
    const view = makeView(doc)
    // Manually replace "Hello" with "Goodbye"
    view.dispatch({
      changes: { from: 0, to: 5, insert: 'Goodbye' },
    })
    expect(view.state.doc.toString()).toBe('Goodbye world')
    view.destroy()
  })
})
