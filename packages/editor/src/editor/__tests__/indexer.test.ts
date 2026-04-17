import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSymbolTable,
  DocumentIndexer,
  INDEXER_BATCH_SIZE,
  indexerExtension,
  symbolTableField,
} from '../indexer'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'

// ---------------------------------------------------------------------------
// buildSymbolTable — pure unit tests
// ---------------------------------------------------------------------------

describe('indexer: buildSymbolTable', () => {
  it('returns an empty table for plain text with no headings', () => {
    const table = buildSymbolTable('Just some plain text.\nNo headings here.')
    expect(table.headings).toHaveLength(0)
    expect(table.anchors.size).toBe(0)
  })

  it('extracts headings and builds an O(1) anchor lookup map', () => {
    const doc = ['# Intro', '', '## Setup', '', '### Deep Dive'].join('\n')
    const table = buildSymbolTable(doc)

    expect(table.headings).toHaveLength(3)
    expect(table.headings[0]).toMatchObject({ anchor: 'intro', level: 1, text: 'Intro' })
    expect(table.headings[1]).toMatchObject({ anchor: 'setup', level: 2, text: 'Setup' })
    expect(table.headings[2]).toMatchObject({ anchor: 'deep-dive', level: 3, text: 'Deep Dive' })

    expect(table.anchors.get('intro')).toBe(table.headings[0].from)
    expect(table.anchors.get('setup')).toBe(table.headings[1].from)
    expect(table.anchors.get('deep-dive')).toBe(table.headings[2].from)
  })

  it('de-duplicates anchors with a numeric suffix', () => {
    const doc = ['# Alpha', '', '# Alpha', '', '# Alpha'].join('\n')
    const table = buildSymbolTable(doc)

    expect(table.headings.map((h) => h.anchor)).toEqual(['alpha', 'alpha-1', 'alpha-2'])
    expect(table.anchors.has('alpha')).toBe(true)
    expect(table.anchors.has('alpha-1')).toBe(true)
    expect(table.anchors.has('alpha-2')).toBe(true)
  })

  it('resolves anchor link positions correctly for a large document', () => {
    const lines: string[] = []
    for (let i = 1; i <= 200; i++) {
      lines.push(`Line ${i}`)
      if (i === 50) lines.push('# Middle Heading')
      if (i === 150) lines.push('# End Heading')
    }
    const doc = lines.join('\n')
    const table = buildSymbolTable(doc)

    expect(table.anchors.has('middle-heading')).toBe(true)
    expect(table.anchors.has('end-heading')).toBe(true)
    // Positions must be positive and in document order
    const midPos = table.anchors.get('middle-heading')!
    const endPos = table.anchors.get('end-heading')!
    expect(midPos).toBeGreaterThan(0)
    expect(endPos).toBeGreaterThan(midPos)
  })

  it('ignores headings inside fenced code blocks', () => {
    const doc = ['# Real Heading', '', '```', '# Not a Heading', '```'].join('\n')
    const table = buildSymbolTable(doc)

    expect(table.headings.map((h) => h.text)).toEqual(['Real Heading'])
    expect(table.anchors.has('not-a-heading')).toBe(false)
  })

  it('tracks setext headings and ignores fenced headings across line boundaries', () => {
    const doc = ['```md', '# Hidden', '```', '', 'Visible title', '---'].join('\n')
    const table = buildSymbolTable(doc)

    expect(table.headings).toEqual([
      {
        anchor: 'visible-title',
        from: doc.indexOf('Visible title'),
        level: 2,
        lineNumber: 5,
        text: 'Visible title',
      },
    ])
  })

  it('uses the active markdown mode when indexing ATX headings without whitespace', () => {
    const doc = ['###Header', '', '### Header'].join('\n')

    expect(buildSymbolTable(doc, 'strict').headings.map((heading) => heading.from)).toEqual([
      doc.indexOf('### Header'),
    ])
    expect(buildSymbolTable(doc, 'tolerant').headings.map((heading) => heading.from)).toEqual([
      0,
      doc.indexOf('### Header'),
    ])
  })
})

// ---------------------------------------------------------------------------
// DocumentIndexer — debounce + async delivery
// ---------------------------------------------------------------------------

describe('indexer: DocumentIndexer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces rapid index() calls and only delivers one result', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 100,
      schedule: (fn) => Promise.resolve().then(fn),
    })

    indexer.index('# First')
    indexer.index('# Second')
    indexer.index('# Third')

    expect(results).toHaveLength(0)

    // Advance past the debounce window
    vi.advanceTimersByTime(150)
    await Promise.resolve()

    // Only the last call's content should be indexed
    expect(results).toHaveLength(1)
    expect(results[0].headings[0].text).toBe('Third')

    indexer.dispose()
  })

  it('delivers results asynchronously without blocking', async () => {
    let delivered = false
    const indexer = new DocumentIndexer(
      () => {
        delivered = true
      },
      { debounceMs: 0, schedule: (fn) => Promise.resolve().then(fn) },
    )

    indexer.index('# Hello')

    // Immediately after scheduling, the result has not been delivered yet
    expect(delivered).toBe(false)

    vi.advanceTimersByTime(10)
    await Promise.resolve()

    expect(delivered).toBe(true)

    indexer.dispose()
  })

  it('indexBatched delivers intermediate results and a final consolidated table', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 0,
      schedule: (fn) => Promise.resolve().then(fn),
    })

    // Build a doc with headings spread across multiple batches
    const lines: string[] = []
    for (let i = 0; i < INDEXER_BATCH_SIZE * 2 + 10; i++) {
      if (i === 0) lines.push('# First Heading')
      else if (i === INDEXER_BATCH_SIZE) lines.push('# Second Heading')
      else if (i === INDEXER_BATCH_SIZE * 2) lines.push('# Third Heading')
      else lines.push(`Line ${i}`)
    }
    const doc = lines.join('\n')

    indexer.indexBatched(doc, INDEXER_BATCH_SIZE)

    vi.advanceTimersByTime(10)
    // Drain microtask queue across all batches
    for (let i = 0; i < 10; i++) {
      await Promise.resolve()
    }

    // Should have received at least an intermediate and a final result
    expect(results.length).toBeGreaterThanOrEqual(1)

    // The last result must include all three headings
    const finalTable = results[results.length - 1]
    expect(finalTable.anchors.has('first-heading')).toBe(true)
    expect(finalTable.anchors.has('second-heading')).toBe(true)
    expect(finalTable.anchors.has('third-heading')).toBe(true)

    indexer.dispose()
  })

  it('indexBatched preserves headings that cross batch boundaries', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 0,
      schedule: (fn) => setTimeout(fn, 0),
    })

    const doc = ['```md', '# Hidden', '```', 'Visible title', '---', '# Tail'].join('\n')

    indexer.indexBatchedImmediately(doc, 4)

    vi.advanceTimersByTime(50)
    await Promise.resolve()

    const finalTable = results.at(-1)
    expect(finalTable?.headings.map((heading) => heading.text)).toEqual([
      'Visible title',
      'Tail',
    ])
    expect(finalTable?.anchors.get('visible-title')).toBe(doc.indexOf('Visible title'))
    expect(finalTable?.anchors.get('tail')).toBe(doc.indexOf('# Tail'))

    indexer.dispose()
  })

  it('indexBatchedImmediately finishes cleanly for empty documents', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 0,
      schedule: (fn) => setTimeout(fn, 0),
    })

    indexer.indexBatchedImmediately('', 1)

    vi.advanceTimersByTime(20)
    await Promise.resolve()

    expect(results.at(-1)).toEqual({
      anchors: new Map(),
      headings: [],
    })

    indexer.dispose()
  })

  it('indexBatchedImmediately preserves headings when the document ends with a trailing newline', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 0,
      schedule: (fn) => setTimeout(fn, 0),
    })

    indexer.indexBatchedImmediately(['# Intro', '', '## Details', ''].join('\n'), 1)

    vi.advanceTimersByTime(50)
    await Promise.resolve()

    expect(results.at(-1)?.headings.map((heading) => heading.text)).toEqual([
      'Intro',
      'Details',
    ])

    indexer.dispose()
  })

  it('dispose() cancels any pending debounced run', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 200,
      schedule: (fn) => Promise.resolve().then(fn),
    })

    indexer.index('# Should Never Arrive')
    indexer.dispose()

    vi.advanceTimersByTime(300)
    await Promise.resolve()

    expect(results).toHaveLength(0)
  })

  it('drops stale async results when a newer document supersedes them', async () => {
    const results: ReturnType<typeof buildSymbolTable>[] = []
    const indexer = new DocumentIndexer((table) => results.push(table), {
      debounceMs: 0,
      schedule: (fn) => Promise.resolve().then(fn),
    })

    indexer.indexBatchedImmediately('# Starter')
    indexer.indexBatchedImmediately('# Replaced')

    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve()
    }

    expect(results).toHaveLength(1)
    expect(results[0].headings.map((heading) => heading.text)).toEqual(['Replaced'])
  })
})

// ---------------------------------------------------------------------------
// CodeMirror extension — symbolTableField integration
// ---------------------------------------------------------------------------

describe('indexer: CodeMirror extension', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('symbolTableField starts empty and is updated via setSymbolTable effect', async () => {
    vi.useFakeTimers()

    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = new EditorView({
      state: EditorState.create({
        doc: '# Hello World\n\n## Getting Started',
        extensions: [
          markdown({ base: markdownLanguage }),
          indexerExtension({ debounceMs: 0 }),
        ],
      }),
      parent,
    })

    // Drain timers and microtask queue
    vi.advanceTimersByTime(10)
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }

    const table = view.state.field(symbolTableField)
    expect(table.headings.length).toBeGreaterThanOrEqual(2)
    expect(table.anchors.has('hello-world')).toBe(true)
    expect(table.anchors.has('getting-started')).toBe(true)

    view.destroy()
    vi.useRealTimers()
  })

  it('symbol table updates when document content changes', async () => {
    vi.useFakeTimers()

    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = new EditorView({
      state: EditorState.create({
        doc: '# Original',
        extensions: [
          markdown({ base: markdownLanguage }),
          indexerExtension({ debounceMs: 0 }),
        ],
      }),
      parent,
    })

    vi.advanceTimersByTime(10)
    for (let i = 0; i < 20; i++) await Promise.resolve()

    // Replace document content
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '# Replaced Heading' },
    })

    vi.advanceTimersByTime(10)
    for (let i = 0; i < 20; i++) await Promise.resolve()

    const table = view.state.field(symbolTableField)
    expect(table.anchors.has('replaced-heading')).toBe(true)
    expect(table.anchors.has('original')).toBe(false)

    view.destroy()
    vi.useRealTimers()
  })
})
