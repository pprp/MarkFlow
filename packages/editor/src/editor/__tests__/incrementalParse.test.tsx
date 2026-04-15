import { afterEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { wysiwygDecorations } from '../decorations/inlineDecorations'
import { setIncrementalParseReporter, type IncrementalParseReport } from '../decorations/incrementalParse'

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    selection: { anchor: doc.length },
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

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

afterEach(() => {
  setIncrementalParseReporter(null)
  document.body.innerHTML = ''
})

describe('incremental parse tracking', () => {
  it('incremental parse only rescans dirty lines and preserves untouched decorations', () => {
    const reports: IncrementalParseReport[] = []
    setIncrementalParseReporter((report) => {
      reports.push(report)
    })

    const doc = ['==alpha==', 'plain text', '==omega=='].join('\n')
    const view = makeView(doc)

    reports.length = 0
    const firstLine = view.state.doc.line(1)
    const thirdLine = view.state.doc.line(3)

    view.dispatch({
      changes: {
        from: firstLine.to,
        insert: '!',
      },
    })

    const report = reports.at(-1)
    expect(report?.mode).toBe('incremental')
    expect(report?.lines).toEqual([{ start: 1, end: 2 }])
    expect(report?.ranges.some((range) => range.from <= thirdLine.from && range.to >= thirdLine.to)).toBe(false)

    const highlights = Array.from(view.dom.querySelectorAll('.mf-highlight')).map((node) => node.textContent)
    expect(highlights).toEqual(expect.arrayContaining(['alpha', 'omega']))

    destroyView(view)
  })

  it('selection-only movement falls back to a full visible-range rebuild', () => {
    const reports: IncrementalParseReport[] = []
    setIncrementalParseReporter((report) => {
      reports.push(report)
    })

    const doc = ['==alpha==', 'plain text', '==omega=='].join('\n')
    const view = makeView(doc)

    reports.length = 0
    const secondLine = view.state.doc.line(2)

    view.dispatch({
      selection: {
        anchor: secondLine.from,
      },
    })

    const report = reports.at(-1)
    expect(report?.mode).toBe('full')
    expect(report?.lines).toEqual([{ start: 1, end: 3 }])

    destroyView(view)
  })
})
