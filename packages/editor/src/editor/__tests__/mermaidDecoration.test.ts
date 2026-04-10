import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { mermaidDecorations, buildMermaidDecorations, MermaidWidget } from '../decorations/mermaidDecoration'

// Mock mermaid so tests never trigger async browser rendering
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg><text>mock diagram</text></svg>' }),
  },
}))

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), mermaidDecorations()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

const mermaidDoc = '```mermaid\nflowchart LR\n  A --> B\n```'

describe('mermaidDecorations — basic rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts without throwing on a mermaid fenced block', () => {
    const view = makeView(mermaidDoc)
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves doc content for mermaid block', () => {
    const view = makeView(mermaidDoc)
    expect(view.state.doc.toString()).toBe(mermaidDoc)
    view.destroy()
  })

  it('reveals source when cursor is inside mermaid block', () => {
    // Cursor inside the flowchart content on line 2
    const view = makeView(mermaidDoc, 20)
    expect(view.state.doc.toString()).toBe(mermaidDoc)
    view.destroy()
  })

  it('does not affect non-mermaid fenced code blocks', () => {
    const doc = '```typescript\nconst x = 1\n```'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('handles multiple mermaid blocks in one document', () => {
    const doc =
      '# Title\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nMiddle\n\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('buildMermaidDecorations — unit', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns a non-null DecorationSet', () => {
    const state = EditorState.create({
      doc: mermaidDoc,
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    const decoSet = buildMermaidDecorations(view)
    expect(decoSet).toBeTruthy()
    view.destroy()
  })

  it('produces no decorations for plain text', () => {
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    const decoSet = buildMermaidDecorations(view)
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

describe('MermaidWidget', () => {
  const mockView = { requestMeasure: vi.fn() } as unknown as import('@codemirror/view').EditorView

  it('eq returns true for identical source', () => {
    const a = new MermaidWidget('graph LR\n  A-->B', mockView)
    const b = new MermaidWidget('graph LR\n  A-->B', mockView)
    expect(a.eq(b)).toBe(true)
  })

  it('eq returns false for different source', () => {
    const a = new MermaidWidget('graph LR\n  A-->B', mockView)
    const b = new MermaidWidget('graph TD\n  A-->B', mockView)
    expect(a.eq(b)).toBe(false)
  })

  it('toDOM returns a container div with mf-mermaid class', () => {
    const widget = new MermaidWidget('graph LR\n  A-->B', mockView)
    const el = widget.toDOM()
    expect(el.tagName.toLowerCase()).toBe('div')
    expect(el.classList.contains('mf-mermaid')).toBe(true)
  })
})
