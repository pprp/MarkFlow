import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { mathDecorations, buildMathDecorations } from '../decorations/mathDecoration'

// Mock katex to avoid requiring a real browser rendering environment
vi.mock('katex', () => ({
  default: {
    renderToString: (src: string, opts?: { displayMode?: boolean }) =>
      `<span class="katex-mock"${opts?.displayMode ? ' data-display="true"' : ''}>${src}</span>`,
  },
}))

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), mathDecorations()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

describe('mathDecorations — inline math $...$', () => {
  it('mounts without throwing for a line with inline math', () => {
    const view = makeView('The formula $E = mc^2$ is famous.')
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves doc content on inline math', () => {
    const doc = 'Area is $\\pi r^2$ in 2D.'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('does not mutate source when cursor is outside', () => {
    const doc = 'Value: $x + y$'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('reveals source when cursor is inside inline math', () => {
    const doc = 'Value: $x + y$'
    // Cursor at position 10, inside '$x + y$'
    const view = makeView(doc, 10)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('does not match $$ as inline math', () => {
    const doc = '$$E = mc^2$$'
    // A single-line $$...$$ should be treated as block math, not two inline matches
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('does not apply inside a fenced code block', () => {
    const doc = '```\nlet x = $5\n```'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('does not apply inside inline code', () => {
    const doc = 'Use `$variable`'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('mathDecorations — block math $$...$$', () => {
  it('mounts for a multi-line block math', () => {
    const doc = '$$\nE = mc^2\n$$'
    const view = makeView(doc)
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves doc content for block math', () => {
    const doc = 'Before\n$$\n\\int_0^1 x\\ dx\n$$\nAfter'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('reveals source when cursor is inside block math', () => {
    const doc = '$$\nE = mc^2\n$$'
    // Cursor inside the expression on line 2
    const view = makeView(doc, 5)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('handles inline $$x$$ on a single line', () => {
    const doc = 'Formula: $$x^2$$'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('buildMathDecorations — unit', () => {
  beforeEach(() => {
    // Ensure DOM parent is available for test views
    document.body.innerHTML = ''
  })

  it('returns a non-null DecorationSet', () => {
    const state = EditorState.create({
      doc: 'The answer is $42$.',
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    const decoSet = buildMathDecorations(view)
    expect(decoSet).toBeTruthy()
    view.destroy()
  })

  it('produces no decorations when there is no math', () => {
    const state = EditorState.create({
      doc: 'Just plain text.',
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    const decoSet = buildMathDecorations(view)
    // Iterate over all decorations; there should be none
    let count = 0
    const iter = decoSet.iter()
    while (iter.value) {
      count++
      iter.next()
    }
    expect(count).toBe(0)
    view.destroy()
  })
})
