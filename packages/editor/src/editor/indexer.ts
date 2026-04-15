/**
 * Background document indexer — builds a symbol table for headings and
 * anchor links without blocking the UI thread.
 *
 * Scheduling strategy: microtask queue (Promise.resolve). In environments
 * that support it, the caller can swap in a real Web Worker by providing a
 * custom `schedule` function. The default microtask-based schedule lets the
 * current JS task finish (and therefore keeps the editor responsive) before
 * the scan runs.
 *
 * For very large documents the content is split into batches so the main
 * thread is never monopolised by a single synchronous pass.
 */

import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { extractOutlineHeadings, type OutlineHeading } from './outline'

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

export function createEmptySymbolTable(): SymbolTable {
  return {
    headings: [],
    anchors: new Map(),
  }
}

// ---------------------------------------------------------------------------
// Core: symbol table builder (pure, synchronous, safe to call from a Worker)
// ---------------------------------------------------------------------------

export function buildSymbolTable(content: string): SymbolTable {
  const headings = extractOutlineHeadings(content)
  const anchors = new Map<string, number>()
  for (const heading of headings) {
    anchors.set(heading.anchor, heading.from)
  }
  return { headings, anchors }
}

// ---------------------------------------------------------------------------
// DocumentIndexer — debounced async coordinator
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 300
/** Lines delivered to the consumer per batch tick. */
export const INDEXER_BATCH_SIZE = 500

export class DocumentIndexer {
  private pendingContent: string | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private readonly debounceMs: number
  private readonly onResult: (table: SymbolTable) => void
  private readonly schedule: IndexerSchedule

  constructor(
    onResult: (table: SymbolTable) => void,
    options: { debounceMs?: number; schedule?: IndexerSchedule } = {},
  ) {
    this.onResult = onResult
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.schedule = options.schedule ?? ((fn) => Promise.resolve().then(fn))
  }

  private clearDebounceTimer() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /** Queue a new indexing run. Rapid successive calls are debounced. */
  index(content: string): void {
    this.pendingContent = content
    const runId = ++this.generation
    this.clearDebounceTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (runId !== this.generation) {
        return
      }
      const snapshot = this.pendingContent
      if (snapshot !== null) {
        this.pendingContent = null
        this.schedule(() => {
          if (runId !== this.generation) {
            return
          }
          const table = buildSymbolTable(snapshot)
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
  indexBatched(content: string, batchSize = INDEXER_BATCH_SIZE): void {
    this.pendingContent = content
    const runId = ++this.generation
    this.clearDebounceTimer()
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      if (runId !== this.generation) {
        return
      }
      const snapshot = this.pendingContent
      if (snapshot !== null) {
        this.pendingContent = null
        this.runBatched(snapshot, batchSize, runId)
      }
    }, this.debounceMs)
  }

  indexBatchedImmediately(content: string, batchSize = INDEXER_BATCH_SIZE): void {
    this.pendingContent = null
    const runId = ++this.generation
    this.clearDebounceTimer()
    this.runBatched(content, batchSize, runId)
  }

  private runBatched(content: string, batchSize: number, runId: number): void {
    if (runId !== this.generation) {
      return
    }
    const lines = content.split('\n')
    let batchStart = 0

    const processNextBatch = () => {
      if (runId !== this.generation) {
        return
      }
      const batchEnd = Math.min(batchStart + batchSize, lines.length)
      // Keep a running character offset so heading positions are absolute
      const chunkContent = lines.slice(0, batchEnd).join('\n')

      if (batchEnd >= lines.length) {
        // Final batch — deliver the authoritative full-document table
        this.schedule(() => {
          if (runId !== this.generation) {
            return
          }
          const table = buildSymbolTable(content)
          this.onResult(table)
        })
        return
      }

      // Intermediate batch: partial table from content seen so far
      this.schedule(() => {
        if (runId !== this.generation) {
          return
        }
        const partialTable = buildSymbolTable(chunkContent)
        this.onResult(partialTable)
        batchStart = batchEnd
        processNextBatch()
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
      indexer.indexBatchedImmediately(view.state.doc.toString())

      return {
        update(update: ViewUpdate) {
          if (update.docChanged) {
            indexer.indexBatched(update.view.state.doc.toString())
          }
        },
        destroy() {
          indexer.dispose()
        },
      }
    }),
  ]
}
