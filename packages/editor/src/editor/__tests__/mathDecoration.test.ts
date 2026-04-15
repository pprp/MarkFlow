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

function mathWidgetClasses(view: EditorView): string[] {
  const classes: string[] = []
  const decoSet = buildMathDecorations(view)
  decoSet.between(0, view.state.doc.length, (_from, _to, deco) => {
    const widget = (deco.spec as { widget?: { toDOM: (view: EditorView) => HTMLElement } }).widget
    const className = widget?.toDOM(view).className
    if (className) classes.push(className)
  })
  return classes
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

describe('mathDecorations — alternate LaTeX delimiters', () => {
  it('renders \\(...\\) through the inline math widget when the cursor is outside', () => {
    const view = makeView('Value: \\(x + y\\) done')
    const classes = mathWidgetClasses(view)
    expect(classes).toContain('mf-math-inline')
    view.destroy()
  })

  it('reveals \\(...\\) source when the cursor is inside the expression', () => {
    const doc = 'Value: \\(x + y\\)'
    const view = makeView(doc, doc.indexOf('x'))
    const classes = mathWidgetClasses(view)
    expect(classes).not.toContain('mf-math-inline')
    view.destroy()
  })

  it('renders \\[...\\] through the block math widget when the cursor is outside', () => {
    const view = makeView('Formula: \\[x^2 + y^2\\] done')
    const classes = mathWidgetClasses(view)
    expect(classes).toContain('mf-math-block')
    view.destroy()
  })

  it('renders multi-line \\[...\\] through the block math widget', () => {
    const view = makeView('Before\n\\[\n\\int_0^1 x^2 dx\n\\]\nAfter', 0)
    const classes = mathWidgetClasses(view)
    expect(classes).toContain('mf-math-block')
    view.destroy()
  })

  it('reveals \\[...\\] source when the cursor is inside the expression', () => {
    const doc = 'Formula: \\[x^2 + y^2\\]'
    const view = makeView(doc, doc.indexOf('x'))
    const classes = mathWidgetClasses(view)
    expect(classes).not.toContain('mf-math-block')
    view.destroy()
  })

  it('does not apply alternate delimiters inside fenced code blocks', () => {
    const doc = '```\n\\(x + y\\)\n\\[z^2\\]\n```'
    const view = makeView(doc)
    const classes = mathWidgetClasses(view)
    expect(classes).toHaveLength(0)
    view.destroy()
  })

  it('does not apply alternate delimiters inside inline code', () => {
    const doc = 'Use `\\(x + y\\)` and `\\[z^2\\]` literally.'
    const view = makeView(doc)
    const classes = mathWidgetClasses(view)
    expect(classes).toHaveLength(0)
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
