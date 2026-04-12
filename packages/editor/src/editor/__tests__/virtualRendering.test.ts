import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLinkDecorations } from '../decorations/linkDecoration'
import { buildMathDecorations } from '../decorations/mathDecoration'
import {
  VIRTUAL_RENDER_LINE_THRESHOLD,
  getDecorationViewportWindow,
} from '../decorations/viewportWindow'

function makeLines(count: number, transform?: (lineNumber: number) => string) {
  return Array.from({ length: count }, (_, index) => {
    const lineNumber = index + 1
    return transform ? transform(lineNumber) : `Line ${lineNumber}`
  }).join('\n')
}

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage })],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function setVisibleLines(view: EditorView, startLine: number, endLine: number) {
  const start = view.state.doc.line(startLine).from
  const end = view.state.doc.line(endLine).to
  Object.defineProperty(view, 'visibleRanges', {
    configurable: true,
    get: () => [{ from: start, to: end }],
  })
}

function collectDecorationStarts(
  decorationSet: ReturnType<typeof buildLinkDecorations> | ReturnType<typeof buildMathDecorations>,
) {
  const starts: number[] = []
  decorationSet.between(0, Number.MAX_SAFE_INTEGER, (from) => {
    starts.push(from)
  })
  return starts
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('virtual rendering window', () => {
  it('keeps small documents on the full-document render path', () => {
    const doc = makeLines(120)
    const view = makeView(doc)

    const window = getDecorationViewportWindow(view)

    expect(window.virtualized).toBe(false)
    expect(window.startLine).toBe(1)
    expect(window.endLine).toBe(120)

    view.destroy()
  })

  it('virtualizes documents over 5,000 lines into a bounded viewport window', () => {
    const doc = makeLines(VIRTUAL_RENDER_LINE_THRESHOLD + 600)
    const view = makeView(doc)
    setVisibleLines(view, 2500, 2550)

    const window = getDecorationViewportWindow(view)

    expect(window.virtualized).toBe(true)
    expect(window.startLine).toBe(2300)
    expect(window.endLine).toBe(2750)
    expect(window.lineCount).toBeLessThan(2000)

    view.destroy()
  })

  it('clamps the virtualized window at the top of the document', () => {
    const doc = makeLines(VIRTUAL_RENDER_LINE_THRESHOLD + 600)
    const view = makeView(doc)
    setVisibleLines(view, 10, 25)

    const window = getDecorationViewportWindow(view)

    expect(window.virtualized).toBe(true)
    expect(window.startLine).toBe(1)
    expect(window.endLine).toBe(225)
    expect(window.lineCount).toBeLessThan(2000)

    view.destroy()
  })

  it('clamps the virtualized window at the bottom of the document', () => {
    const doc = makeLines(VIRTUAL_RENDER_LINE_THRESHOLD + 600)
    const view = makeView(doc)
    setVisibleLines(view, 5575, 5600)

    const window = getDecorationViewportWindow(view)

    expect(window.virtualized).toBe(true)
    expect(window.startLine).toBe(5375)
    expect(window.endLine).toBe(5600)
    expect(window.lineCount).toBeLessThan(2000)

    view.destroy()
  })

  it('limits link decorations to the virtualized viewport window for large files', () => {
    const doc = makeLines(VIRTUAL_RENDER_LINE_THRESHOLD + 200, (lineNumber) => {
      if (lineNumber === 40) return '[[near-link]]'
      if (lineNumber === 5100) return '[[far-link]]'
      return `Line ${lineNumber}`
    })
    const view = makeView(doc)
    setVisibleLines(view, 35, 45)

    const decorations = buildLinkDecorations(view)
    const starts = collectDecorationStarts(decorations)
    const nearLine = view.state.doc.line(40)
    const farLine = view.state.doc.line(5100)

    expect(starts.some((from) => from >= nearLine.from && from <= nearLine.to)).toBe(true)
    expect(starts.some((from) => from >= farLine.from && from <= farLine.to)).toBe(false)

    view.destroy()
  })

  it('limits math decorations to the virtualized viewport window for large files', () => {
    const doc = makeLines(VIRTUAL_RENDER_LINE_THRESHOLD + 200, (lineNumber) => {
      if (lineNumber === 60) return 'Visible $x^2$ math'
      if (lineNumber === 5150) return 'Hidden $y^2$ math'
      return `Line ${lineNumber}`
    })
    const view = makeView(doc)
    setVisibleLines(view, 55, 65)

    const decorations = buildMathDecorations(view)
    const starts = collectDecorationStarts(decorations)
    const nearLine = view.state.doc.line(60)
    const farLine = view.state.doc.line(5150)

    expect(starts.some((from) => from >= nearLine.from && from <= nearLine.to)).toBe(true)
    expect(starts.some((from) => from >= farLine.from && from <= farLine.to)).toBe(false)

    view.destroy()
  })
})
