/**
 * Background document indexer — builds a symbol table for headings and
 * anchor links without blocking the UI thread.
 *
 * Scheduling strategy: macrotask queue (`setTimeout(…, 0)`). In environments
 * that support it, the caller can swap in a real Web Worker by providing a
 * custom `schedule` function. The default macrotask-based schedule yields
 * between batches so large documents do not monopolise the main thread.
 *
 * For very large documents the content is split into batches so the main
 * thread is never monopolised by a single synchronous pass.
 */

import { StateEffect, StateField, Text, type Extension } from '@codemirror/state'
import { ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { normalizeHeadingAnchor, type OutlineHeading } from './outline'
import {
  DEFAULT_MARKDOWN_MODE,
  type MarkFlowMarkdownMode,
} from '../markdownMode'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SymbolEntry = OutlineHeading

export interface SymbolTable {
  /** Ordered list of heading symbols. */
  headings: SymbolEntry[]
  /** Fast anchor → character-offset look-up table. */
  anchors: Map<string, number>
}

export type IndexerSchedule = (fn: () => void) => void
type IndexerSource = string | Text

export function createEmptySymbolTable(): SymbolTable {
  return {
    headings: [],
    anchors: new Map(),
  }
}

// ---------------------------------------------------------------------------
// Core: symbol table builder (pure, synchronous, safe to call from a Worker)
// ---------------------------------------------------------------------------

function appendSourceToBuilder(
  content: IndexerSource,
  builder: SymbolTableBuilder,
) {
  if (typeof content === 'string') {
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      builder.appendLine(lines[index], index < lines.length - 1)
    }
    return
  }

  const iterator = content.iterLines()
  for (let lineNumber = 1; lineNumber <= content.lines; lineNumber += 1) {
    iterator.next()
    builder.appendLine(iterator.value, lineNumber < content.lines)
  }
}

export function buildSymbolTable(
  content: IndexerSource,
  markdownMode: MarkFlowMarkdownMode = DEFAULT_MARKDOWN_MODE,
): SymbolTable {
  const builder = new SymbolTableBuilder(markdownMode)
  appendSourceToBuilder(content, builder)
  return builder.toSymbolTable()
}

type FenceState = {
  marker: '`' | '~'
  size: number
}

type PendingSetextLine = {
  from: number
  lineNumber: number
  text: string
}

function readIndent(line: string) {
  let column = 0
  let index = 0

  while (index < line.length) {
    const next = line[index]
    if (next === ' ') {
      column += 1
      index += 1
      continue
    }

    if (next === '\t') {
      column += 4 - (column % 4)
      index += 1
      continue
    }

    break
  }

  return { column, index }
}

function getLineContentStart(line: string, fallbackIndex: number) {
  for (let index = fallbackIndex; index < line.length; index += 1) {
    const next = line[index]
    if (next !== ' ' && next !== '\t') {
      return index
    }
  }

  return fallbackIndex
}

function parseFence(line: string) {
  const { column, index } = readIndent(line)
  if (column > 3 || index >= line.length) {
    return null
  }

  const marker = line[index]
  if (marker !== '`' && marker !== '~') {
    return null
  }

  let end = index
  while (end < line.length && line[end] === marker) {
    end += 1
  }

  const size = end - index
  if (size < 3) {
    return null
  }

  return {
    marker,
    size,
    rest: line.slice(end),
  } as const
}

function parseSetextUnderline(line: string) {
  const { column, index } = readIndent(line)
  if (column > 3) {
    return null
  }

  const trimmed = line.slice(index).trim()
  if (!trimmed) {
    return null
  }

  if (/^=+$/.test(trimmed)) {
    return 1
  }

  if (/^-+$/.test(trimmed)) {
    return 2
  }

  return null
}

function parseAtxHeading(
  line: string,
  markdownMode: MarkFlowMarkdownMode,
): { from: number; level: number; text: string } | null {
  const { column, index } = readIndent(line)
  if (column > 3 || line[index] !== '#') {
    return null
  }

  let markerEnd = index
  while (markerEnd < line.length && line[markerEnd] === '#') {
    markerEnd += 1
  }

  const level = markerEnd - index
  if (level === 0 || level > 6) {
    return null
  }

  const nextChar = line[markerEnd]
  const hasRequiredWhitespace = nextChar == null || nextChar === ' ' || nextChar === '\t'
  if (markdownMode === 'strict' && !hasRequiredWhitespace) {
    return null
  }

  const rawHeading = line.slice(index)
  const text = rawHeading
    .replace(/^#{1,6}\s*/, '')
    .replace(/\s*#*\s*$/, '')
    .trim()
  if (!text) {
    return null
  }

  return {
    from: index,
    level,
    text,
  }
}

class SymbolTableBuilder {
  private readonly headings: OutlineHeading[] = []
  private readonly anchors = new Map<string, number>()
  private readonly seenAnchors = new Map<string, number>()
  private fence: FenceState | null = null
  private pendingSetext: PendingSetextLine | null = null
  private offset = 0
  private lineNumber = 1

  constructor(private readonly markdownMode: MarkFlowMarkdownMode) {}

  get headingCount() {
    return this.headings.length
  }

  appendLine(line: string, hasTrailingNewline: boolean) {
    const lineStart = this.offset
    const currentLineNumber = this.lineNumber
    const advance = () => {
      this.offset += line.length + (hasTrailingNewline ? 1 : 0)
      this.lineNumber += 1
    }

    if (this.fence) {
      const fence = parseFence(line)
      if (
        fence &&
        fence.marker === this.fence.marker &&
        fence.size >= this.fence.size &&
        fence.rest.trim() === ''
      ) {
        this.fence = null
      }
      this.pendingSetext = null
      advance()
      return
    }

    const openingFence = parseFence(line)
    if (openingFence) {
      this.fence = {
        marker: openingFence.marker,
        size: openingFence.size,
      }
      this.pendingSetext = null
      advance()
      return
    }

    const underlineLevel = parseSetextUnderline(line)
    if (underlineLevel !== null) {
      if (this.pendingSetext) {
        this.addHeading(
          this.pendingSetext.text,
          this.pendingSetext.from,
          underlineLevel,
          this.pendingSetext.lineNumber,
        )
      }
      this.pendingSetext = null
      advance()
      return
    }

    const atxHeading = parseAtxHeading(line, this.markdownMode)
    if (atxHeading) {
      this.pendingSetext = null
      this.addHeading(
        atxHeading.text,
        lineStart + atxHeading.from,
        atxHeading.level,
        currentLineNumber,
      )
      advance()
      return
    }

    const { column, index } = readIndent(line)
    const contentStart = getLineContentStart(line, index)
    const text = column > 3 ? '' : line.slice(contentStart).trim()
    this.pendingSetext = text
      ? {
          from: lineStart + contentStart,
          lineNumber: currentLineNumber,
          text,
        }
      : null

    advance()
  }

  toSymbolTable(): SymbolTable {
    return {
      headings: this.headings.slice(),
      anchors: new Map(this.anchors),
    }
  }

  private addHeading(text: string, from: number, level: number, lineNumber: number) {
    const baseAnchor = normalizeHeadingAnchor(text)
    if (!baseAnchor) {
      return
    }

    const duplicateIndex = this.seenAnchors.get(baseAnchor) ?? 0
    this.seenAnchors.set(baseAnchor, duplicateIndex + 1)

    const anchor = duplicateIndex === 0 ? baseAnchor : `${baseAnchor}-${duplicateIndex}`
    this.headings.push({
      anchor,
      from,
      level,
      lineNumber,
      text,
    })
    this.anchors.set(anchor, from)
  }
}

// ---------------------------------------------------------------------------
// DocumentIndexer — debounced async coordinator
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 300
/**
 * Lines delivered to the consumer per batch tick.
 *
 * A 2k-line chunk still fits comfortably inside one scheduled task, but it
 * reduces batch-count overhead enough for early outline headings to arrive
 * promptly on the 180k-line verification fixture.
 */
export const INDEXER_BATCH_SIZE = 2_000

type StringLineCursor = {
  kind: 'string'
  deliveredTerminalEmptyLine: boolean
  nextIndex: number
}

type TextLineCursor = {
  kind: 'text'
  iterator: ReturnType<Text['iterLines']>
  lineNumber: number
  totalLines: number
}

type LineCursor = StringLineCursor | TextLineCursor

function createLineCursor(content: IndexerSource): LineCursor {
  if (typeof content === 'string') {
    return {
      kind: 'string',
      deliveredTerminalEmptyLine: false,
      nextIndex: 0,
    }
  }

  return {
    kind: 'text',
    iterator: content.iterLines(),
    lineNumber: 0,
    totalLines: content.lines,
  }
}

function readNextLine(content: IndexerSource, cursor: LineCursor) {
  if (cursor.kind === 'text') {
    if (cursor.lineNumber >= cursor.totalLines) {
      return null
    }

    cursor.iterator.next()
    cursor.lineNumber += 1
    return {
      hasTrailingNewline: cursor.lineNumber < cursor.totalLines,
      line: cursor.iterator.value,
    }
  }

  const stringContent = content as string

  if (cursor.nextIndex > stringContent.length) {
    return null
  }

  if (cursor.nextIndex === stringContent.length) {
    if (cursor.deliveredTerminalEmptyLine) {
      return null
    }

    cursor.deliveredTerminalEmptyLine = true
    cursor.nextIndex = stringContent.length + 1
    return {
      hasTrailingNewline: false,
      line: '',
    }
  }

  const lineEnd = stringContent.indexOf('\n', cursor.nextIndex)
  if (lineEnd === -1) {
    const line = stringContent.slice(cursor.nextIndex)
    cursor.nextIndex = stringContent.length + 1
    return {
      hasTrailingNewline: false,
      line,
    }
  }

  const line = stringContent.slice(cursor.nextIndex, lineEnd)
  cursor.nextIndex = lineEnd + 1
  return {
    hasTrailingNewline: true,
    line,
  }
}

export class DocumentIndexer {
  private pendingContent: IndexerSource | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private readonly debounceMs: number
  private readonly markdownMode: MarkFlowMarkdownMode
  private readonly onResult: (table: SymbolTable) => void
  private readonly schedule: IndexerSchedule

  constructor(
    onResult: (table: SymbolTable) => void,
    options: {
      debounceMs?: number
      markdownMode?: MarkFlowMarkdownMode
      schedule?: IndexerSchedule
    } = {},
  ) {
    this.onResult = onResult
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.markdownMode = options.markdownMode ?? DEFAULT_MARKDOWN_MODE
    this.schedule = options.schedule ?? ((fn) => {
      setTimeout(fn, 0)
    })
  }

  private clearDebounceTimer() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /** Queue a new indexing run. Rapid successive calls are debounced. */
  index(content: IndexerSource): void {
    this.pendingContent = content
    this.clearDebounceTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      const snapshot = this.pendingContent
      if (snapshot !== null) {
        this.pendingContent = null
        const runId = ++this.generation
        this.schedule(() => {
          if (runId !== this.generation) {
            return
          }
          const table = buildSymbolTable(snapshot, this.markdownMode)
          this.onResult(table)
        })
      }
    }, this.debounceMs)
  }

  /**
   * Index the content in batched chunks, delivering partial results after
   * each batch so callers see headings accumulate progressively.
   *
   * The content is split by newlines into groups of `batchSize` lines. After
   * every group a microtask boundary is crossed so the main thread stays
   * responsive. A final consolidated result is delivered at the end.
   */
  indexBatched(content: IndexerSource, batchSize = INDEXER_BATCH_SIZE): void {
    this.pendingContent = content
    this.clearDebounceTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      const snapshot = this.pendingContent
      if (snapshot !== null) {
        this.pendingContent = null
        const runId = ++this.generation
        this.runBatched(snapshot, batchSize, runId)
      }
    }, this.debounceMs)
  }

  indexBatchedImmediately(content: IndexerSource, batchSize = INDEXER_BATCH_SIZE): void {
    this.pendingContent = null
    const runId = ++this.generation
    this.clearDebounceTimer()
    this.runBatched(content, batchSize, runId)
  }

  private runBatched(content: IndexerSource, batchSize: number, runId: number): void {
    if (runId !== this.generation) {
      return
    }
    const builder = new SymbolTableBuilder(this.markdownMode)
    const cursor = createLineCursor(content)

    const processNextBatch = () => {
      if (runId !== this.generation) {
        return
      }
      this.schedule(() => {
        if (runId !== this.generation) {
          return
        }

        const headingCountBeforeBatch = builder.headingCount
        let processedLines = 0
        while (processedLines < batchSize) {
          const nextLine = readNextLine(content, cursor)
          if (!nextLine) {
            break
          }

          builder.appendLine(nextLine.line, nextLine.hasTrailingNewline)
          processedLines += 1
        }

        const isComplete =
          cursor.kind === 'string'
            ? cursor.nextIndex > content.length
            : cursor.lineNumber >= cursor.totalLines
        if (builder.headingCount > headingCountBeforeBatch || isComplete) {
          this.onResult(builder.toSymbolTable())
        }

        if (!isComplete) {
          processNextBatch()
        }
      })
    }

    processNextBatch()
  }

  dispose(): void {
    this.generation += 1
    this.pendingContent = null
    this.clearDebounceTimer()
  }
}

// ---------------------------------------------------------------------------
// CodeMirror integration
// ---------------------------------------------------------------------------

/** StateEffect used to push an updated SymbolTable into the editor state. */
export const setSymbolTable = StateEffect.define<SymbolTable>()

/** Editor state field that holds the current symbol table. */
export const symbolTableField = StateField.define<SymbolTable>({
  create() {
    return createEmptySymbolTable()
  },
  update(table, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSymbolTable)) {
        return effect.value
      }
    }
    return table
  },
})

/**
 * CodeMirror extension that keeps the symbol table up-to-date in the
 * background as the document changes.
 *
 * Usage:
 *   `EditorView.create({ extensions: [indexerExtension()] })`
 */
export function indexerExtension(options: {
  debounceMs?: number
  markdownMode?: MarkFlowMarkdownMode
  schedule?: IndexerSchedule
} = {}): Extension {
  return [
    symbolTableField,
    ViewPlugin.define((view) => {
      const indexer = new DocumentIndexer(
        (table) => {
          view.dispatch({ effects: setSymbolTable.of(table) })
        },
        options,
      )

      // Populate the initial symbol table immediately, but still off the
      // current call stack so large files never block editor mount.
      indexer.indexBatchedImmediately(view.state.doc)

      return {
        update(update: ViewUpdate) {
          if (update.docChanged) {
            indexer.indexBatched(update.view.state.doc)
          }
        },
        destroy() {
          indexer.dispose()
        },
      }
    }),
  ]
}
