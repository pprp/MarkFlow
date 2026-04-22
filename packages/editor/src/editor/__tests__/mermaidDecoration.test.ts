import { waitFor } from '@testing-library/react'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDiagramDecorations,
  DiagramWidget,
  diagramDecorations,
  normalizeDiagramSource,
  resetDiagramRenderState,
} from '../decorations/mermaidDecoration'

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(async (id: string, source: string) => {
    if (source.includes('BROKEN_SEQUENCE')) {
      throw new Error('Parse error near BROKEN_SEQUENCE')
    }

    return { svg: `<svg data-render-id="${id}" data-source-length="${source.length}"></svg>` }
  }),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}))

const mountedViews = new Set<EditorView>()

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), diagramDecorations()],
  })

  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({ state, parent })
  mountedViews.add(view)
  return { view, parent }
}

describe('diagramDecorations', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mountedViews.clear()
    renderMock.mockClear()
    initializeMock.mockClear()
    resetDiagramRenderState()
  })

  afterEach(() => {
    for (const view of mountedViews) {
      view.destroy()
    }
    mountedViews.clear()
    document.body.innerHTML = ''
  })

  it('preserves document content for diagram fences', () => {
    const doc = '```mermaid\nflowchart LR\n  A --> B\n```'
    const { view } = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
  })

  it('keeps rendering decorations when the cursor is inside a diagram block', () => {
    const doc = '```flow\nst=>start: Start\nst->e\ne=>end: End\n```'
    const { view } = makeView(doc, 18)
    const decorations = buildDiagramDecorations(view)
    let count = 0
    const iter = decorations.iter()
    while (iter.value) {
      count += 1
      iter.next()
    }
    expect(count).toBeGreaterThan(0)
  })

  it('renders flow, sequence, and mermaid sequence/gantt/Venn/Ishikawa fences through the diagram pipeline', async () => {
    const doc = [
      '```flow',
      'st=>start: Start',
      'step=>operation: Ship it',
      'done=>end: Done',
      'st->step->done',
      '```',
      '',
      '```sequence',
      'Alice->Bob: Ping',
      '```',
      '',
      '```mermaid',
      'sequenceDiagram',
      '  Alice->>Bob: Hi',
      '```',
      '',
      '```mermaid',
      'gantt',
      '  title Release',
      '  dateFormat YYYY-MM-DD',
      '```',
      '',
      '```mermaid',
      'venn-beta',
      '  title Site overlap',
      '  set A ["Backend"]:12',
      '  set B ["Frontend"]:8',
      '  union A,B ["Full-stack"]:3',
      '```',
      '',
      '```mermaid',
      'ishikawa',
      'Defects escape review',
      '  People',
      '    Reviewer load',
      '  Process',
      '    Missing checklist',
      '```',
    ].join('\n')

    makeView(doc)

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(6)
    })

    const renderedSources = renderMock.mock.calls.map(([, source]) => source as string)
    expect(renderedSources).toContain(
      ['flowchart TD', '  st([Start])', '  step[Ship it]', '  done([Done])', '  st --> step', '  step --> done'].join(
        '\n',
      ),
    )
    expect(renderedSources.some((source) => source.startsWith('sequenceDiagram\nAlice->Bob: Ping'))).toBe(true)
    expect(renderedSources).toContain(['sequenceDiagram', '  Alice->>Bob: Hi'].join('\n'))
    expect(renderedSources).toContain(['gantt', '  title Release', '  dateFormat YYYY-MM-DD'].join('\n'))
    expect(renderedSources).toContain(
      [
        'venn-beta',
        '  title Site overlap',
        '  set A ["Backend"]:12',
        '  set B ["Frontend"]:8',
        '  union A,B ["Full-stack"]:3',
      ].join('\n'),
    )
    expect(renderedSources).toContain(
      [
        'ishikawa',
        'Defects escape review',
        '  People',
        '    Reviewer load',
        '  Process',
        '    Missing checklist',
      ].join('\n'),
    )
  })

  it('shows a block-local render error without breaking sibling diagrams', async () => {
    const doc = [
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      '```sequence',
      'BROKEN_SEQUENCE',
      '```',
    ].join('\n')

    const { parent } = makeView(doc)

    await waitFor(() => {
      expect(parent.querySelectorAll('.mf-diagram').length).toBe(2)
      expect(parent.querySelectorAll('.mf-diagram svg').length).toBe(1)
      expect(parent.querySelectorAll('.mf-diagram-error').length).toBe(1)
    })

    expect(parent.textContent).toContain('Unable to render sequence diagram')
  })

  it('re-renders edited diagrams on the next idle pass without duplicate DOM nodes', async () => {
    const initialDoc = ['```sequence', 'Alice->Bob: First pass', '```'].join('\n')
    const updatedDoc = ['```sequence', 'Alice->Bob: Second pass', '```'].join('\n')
    const { view, parent } = makeView(initialDoc)

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(1)
      expect(parent.querySelectorAll('.mf-diagram svg').length).toBe(1)
    })

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: updatedDoc },
    })

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(2)
      expect(parent.querySelectorAll('.mf-diagram').length).toBe(1)
      expect(parent.querySelectorAll('.mf-diagram svg').length).toBe(1)
    })

    expect(renderMock.mock.calls.at(-1)?.[1]).toContain('Second pass')
  })
})

describe('buildDiagramDecorations', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    mountedViews.clear()
    renderMock.mockClear()
    initializeMock.mockClear()
    resetDiagramRenderState()
  })

  afterEach(() => {
    for (const view of mountedViews) {
      view.destroy()
    }
    mountedViews.clear()
    document.body.innerHTML = ''
  })

  it('returns a non-empty DecorationSet for diagram fences', () => {
    const state = EditorState.create({
      doc: '```mermaid\nflowchart LR\n  A --> B\n```',
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    mountedViews.add(view)

    const decorations = buildDiagramDecorations(view)
    expect(decorations).toBeTruthy()
  })

  it('produces no decorations for plain text', () => {
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [markdown({ base: markdownLanguage })],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    mountedViews.add(view)

    const decorations = buildDiagramDecorations(view)
    let count = 0
    const iter = decorations.iter()
    while (iter.value) {
      count += 1
      iter.next()
    }
    expect(count).toBe(0)
  })
})

describe('normalizeDiagramSource', () => {
  it('passes Mermaid Venn and Ishikawa-compatible sources through unchanged', () => {
    const vennSource = [
      'venn-beta',
      '  set A ["Backend"]:12',
      '  set B ["Frontend"]:8',
      '  union A,B ["Full-stack"]:3',
    ].join('\n')
    const ishikawaSource = [
      'ishikawa',
      'Defects escape review',
      '  People',
      '    Reviewer load',
      '  Process',
      '    Missing checklist',
    ].join('\n')

    expect(normalizeDiagramSource('mermaid', vennSource)).toBe(vennSource)
    expect(normalizeDiagramSource('mermaid', ishikawaSource)).toBe(ishikawaSource)
  })

  it('prefixes raw sequence fences with Mermaid sequenceDiagram', () => {
    expect(normalizeDiagramSource('sequence', 'Alice->Bob: Hi')).toBe('sequenceDiagram\nAlice->Bob: Hi')
  })

  it('converts flowchart fences into Mermaid flowcharts', () => {
    expect(
      normalizeDiagramSource(
        'flow',
        ['st=>start: Start', 'cond=>condition: Yes or no?', 'done=>end: Done', 'st->cond', 'cond(yes)->done'].join(
          '\n',
        ),
      ),
    ).toBe(
      [
        'flowchart TD',
        '  st([Start])',
        '  cond{Yes or no?}',
        '  done([Done])',
        '  st --> cond',
        '  cond -->|yes| done',
      ].join('\n'),
    )
  })
})

describe('DiagramWidget', () => {
  const mockView = { requestMeasure: vi.fn() } as unknown as import('@codemirror/view').EditorView

  beforeEach(() => {
    renderMock.mockClear()
    initializeMock.mockClear()
    resetDiagramRenderState()
  })

  it('eq returns true for identical language and source', () => {
    const a = new DiagramWidget('mermaid', 'graph LR\n  A-->B', mockView)
    const b = new DiagramWidget('mermaid', 'graph LR\n  A-->B', mockView)
    expect(a.eq(b)).toBe(true)
  })

  it('eq returns false for different diagram languages', () => {
    const a = new DiagramWidget('mermaid', 'graph LR\n  A-->B', mockView)
    const b = new DiagramWidget('sequence', 'graph LR\n  A-->B', mockView)
    expect(a.eq(b)).toBe(false)
  })

  it('toDOM returns a container div with diagram classes', () => {
    const widget = new DiagramWidget('flow', 'st=>start: Start\nst->e\ne=>end: End', mockView)
    const element = widget.toDOM()
    expect(element.tagName.toLowerCase()).toBe('div')
    expect(element.classList.contains('mf-diagram')).toBe(true)
    expect(element.classList.contains('mf-mermaid')).toBe(true)
  })
})
