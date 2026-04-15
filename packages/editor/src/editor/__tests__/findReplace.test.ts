import { afterEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  findNext,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  search,
  searchKeymap,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search'

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({ base: markdownLanguage }),
      search({ top: true }),
      keymap.of(searchKeymap),
      highlightSelectionMatches(),
    ],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function getSearchPanel(view: EditorView) {
  const panel = view.dom.querySelector('.cm-search')
  expect(panel).not.toBeNull()
  return panel as HTMLElement
}

function getPanelField(view: EditorView, name: string) {
  const field = getSearchPanel(view).querySelector(`input[name="${name}"]`)
  expect(field).not.toBeNull()
  return field as HTMLInputElement
}

function setTextFieldValue(field: HTMLInputElement, value: string) {
  field.value = value
  field.dispatchEvent(new Event('keyup', { bubbles: true }))
}

function setCheckboxValue(field: HTMLInputElement, checked: boolean) {
  field.checked = checked
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('find and replace', () => {
  it('keeps CodeMirror find-next bindings registered', () => {
    const keys = searchKeymap.map((binding) => binding.key)
    expect(keys).toContain('Mod-f')
    expect(keys.some((key) => key === 'Mod-g' || key === 'F3')).toBe(true)
    expect(keys).toContain('Escape')
  })

  it('opens a search panel with replace and toggle controls', () => {
    const view = makeView('Hello world. Hello again.')

    expect(openSearchPanel(view)).toBe(true)
    expect(searchPanelOpen(view.state)).toBe(true)
    expect(getPanelField(view, 'search')).toBeInstanceOf(HTMLInputElement)
    expect(getPanelField(view, 'replace')).toBeInstanceOf(HTMLInputElement)
    expect(getPanelField(view, 'case').type).toBe('checkbox')
    expect(getPanelField(view, 're').type).toBe('checkbox')
    expect(getPanelField(view, 'word').type).toBe('checkbox')

    view.destroy()
  })

  it('commits regex, case-sensitive, and whole-word toggles from the panel into search state', () => {
    const view = makeView('cat Cat catfish')

    openSearchPanel(view)

    setTextFieldValue(getPanelField(view, 'search'), '(cat)')
    setTextFieldValue(getPanelField(view, 'replace'), '<$1>')
    setCheckboxValue(getPanelField(view, 'case'), true)
    setCheckboxValue(getPanelField(view, 're'), true)
    setCheckboxValue(getPanelField(view, 'word'), true)

    const query = getSearchQuery(view.state)
    expect(query.search).toBe('(cat)')
    expect(query.replace).toBe('<$1>')
    expect(query.caseSensitive).toBe(true)
    expect(query.regexp).toBe(true)
    expect(query.wholeWord).toBe(true)

    view.destroy()
  })

  it('navigates between live-document matches with findNext', () => {
    const doc = 'Alpha beta Alpha'
    const view = makeView(doc)

    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: 'Alpha' })),
    })

    expect(findNext(view)).toBe(true)
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('Alpha')
    expect(view.state.selection.main.from).toBe(0)

    expect(findNext(view)).toBe(true)
    expect(view.state.selection.main.from).toBe(doc.lastIndexOf('Alpha'))
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('Alpha')

    view.destroy()
  })

  it('supports regexp replace-all with capture groups', () => {
    const view = makeView('alpha-01 beta-02')

    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: '(\\w+)-(\\d+)',
          regexp: true,
          replace: '$2:$1',
        }),
      ),
    })

    expect(replaceAll(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('01:alpha 02:beta')

    view.destroy()
  })

  it('limits case-sensitive replacements to exact-case matches', () => {
    const view = makeView('cat Cat cAt cat')

    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: 'cat',
          caseSensitive: true,
          replace: 'dog',
        }),
      ),
    })

    expect(replaceAll(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('dog Cat cAt dog')

    view.destroy()
  })

  it('limits whole-word replacements to standalone matches', () => {
    const view = makeView('cat scatter catfish cat')

    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({
          search: 'cat',
          wholeWord: true,
          replace: 'dog',
        }),
      ),
    })

    expect(replaceAll(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('dog scatter catfish dog')

    view.destroy()
  })
})
