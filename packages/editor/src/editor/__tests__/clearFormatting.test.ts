import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { describe, expect, it } from 'vitest'
import { clearFormatting } from '../clearFormatting'

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function selectFirst(view: EditorView, text: string) {
  const from = view.state.doc.toString().indexOf(text)
  expect(from).toBeGreaterThanOrEqual(0)
  view.dispatch({
    selection: EditorSelection.range(from, from + text.length),
  })
}

describe('clearFormatting', () => {
  it('unwraps a mixed selection of inline markdown into plain text', () => {
    const doc = 'Before **bold** *italic* `code` ~~strike~~ ==mark== [link](url) after'
    const view = makeView(doc)

    const from = doc.indexOf('**bold**')
    const to = doc.indexOf('[link](url)') + '[link](url)'.length
    view.dispatch({
      selection: EditorSelection.range(from, to),
    })

    expect(clearFormatting(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('Before bold italic code strike mark link after')
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'bold italic code strike mark link',
    )

    view.destroy()
  })

  it.each([
    {
      label: 'emphasis',
      doc: 'Prefix *alpha* suffix',
      expected: 'Prefix *a*lp*ha* suffix',
    },
    {
      label: 'inline code',
      doc: 'Prefix `alpha` suffix',
      expected: 'Prefix `a`lp`ha` suffix',
    },
    {
      label: 'strikethrough',
      doc: 'Prefix ~~alpha~~ suffix',
      expected: 'Prefix ~~a~~lp~~ha~~ suffix',
    },
    {
      label: 'highlight',
      doc: 'Prefix ==alpha== suffix',
      expected: 'Prefix ==a==lp==ha== suffix',
    },
    {
      label: 'link',
      doc: 'Prefix [alpha](url) suffix',
      expected: 'Prefix [a](url)lp[ha](url) suffix',
    },
  ])('splits surrounding %s markup when clearing a middle range', ({ doc, expected }) => {
    const view = makeView(doc)

    selectFirst(view, 'lp')

    expect(clearFormatting(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(expected)
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('lp')

    view.destroy()
  })

  it('removes nested bold, italic, and link wrappers when clearing the full formatted span', () => {
    const doc = 'Before [***alpha***](url) after'
    const view = makeView(doc)

    selectFirst(view, '[***alpha***](url)')

    expect(clearFormatting(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('Before alpha after')
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('alpha')

    view.destroy()
  })

  it('splits every nested wrapper around a live middle selection', () => {
    const doc = 'Before [***alpha beta gamma***](url) after'
    const view = makeView(doc)

    selectFirst(view, 'beta')

    expect(clearFormatting(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(
      'Before [***alpha ***](url)beta[*** gamma***](url) after',
    )
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'beta',
    )

    view.destroy()
  })
})
