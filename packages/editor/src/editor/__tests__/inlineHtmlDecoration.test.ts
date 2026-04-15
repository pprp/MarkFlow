import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { inlineHtmlDecorations } from '../decorations/inlineHtmlDecoration'

function makeView(doc: string, cursor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage }),
      inlineHtmlDecorations(),
      EditorView.lineWrapping,
    ],
  })

  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function lineText(view: EditorView, index: number) {
  return view.dom.querySelectorAll('.cm-line').item(index)?.textContent ?? ''
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

describe('inlineHtmlDecorations', () => {
  it('hides block HTML comments away from the caret and reveals them when editing', () => {
    const doc = ['Before', '', '<!-- hidden note -->', '', 'After'].join('\n')
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(view.dom.querySelectorAll('.mf-html-block')).toHaveLength(1)
    expect(lineText(view, 2)).not.toContain('<!-- hidden note -->')

    view.dispatch({ selection: { anchor: doc.indexOf('hidden') } })

    expect(view.dom.querySelector('.mf-html-block')).toBeNull()
    expect(lineText(view, 2)).toContain('<!-- hidden note -->')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(view.dom.querySelectorAll('.mf-html-block')).toHaveLength(1)
    expect(lineText(view, 2)).not.toContain('<!-- hidden note -->')

    destroyView(view)
  })

  it('hides inline HTML comments away from the caret and restores their source when focused', () => {
    const doc = 'Hello <!-- note --> world'
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(1)
    expect(lineText(view, 0)).not.toContain('<!-- note -->')

    view.dispatch({ selection: { anchor: doc.indexOf('note') } })

    expect(view.dom.querySelector('.mf-html-inline')).toBeNull()
    expect(lineText(view, 0)).toContain('<!-- note -->')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(1)
    expect(lineText(view, 0)).not.toContain('<!-- note -->')

    destroyView(view)
  })

  it('renders HTML entities as decoded characters away from the caret and preserves raw source on focus', () => {
    const doc = 'Symbols: &copy; &reg; &nbsp;'
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(Array.from(view.dom.querySelectorAll('.mf-html-inline')).map((element) => element.textContent)).toEqual([
      '©',
      '®',
      '\u00a0',
    ])
    expect(lineText(view, 0)).toContain('©')
    expect(lineText(view, 0)).toContain('®')
    expect(lineText(view, 0)).not.toContain('&copy;')
    expect(lineText(view, 0)).not.toContain('&reg;')
    expect(lineText(view, 0)).not.toContain('&nbsp;')

    view.dispatch({ selection: { anchor: doc.indexOf('&copy;') + 1 } })

    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(2)
    expect(lineText(view, 0)).toContain('&copy;')
    expect(lineText(view, 0)).not.toContain('&reg;')
    expect(lineText(view, 0)).not.toContain('&nbsp;')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(Array.from(view.dom.querySelectorAll('.mf-html-inline')).map((element) => element.textContent)).toEqual([
      '©',
      '®',
      '\u00a0',
    ])

    destroyView(view)
  })
})
