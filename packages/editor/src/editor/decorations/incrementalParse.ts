import { ViewPlugin, type ViewUpdate } from '@codemirror/view'

export interface DirtyRegion {
  from: number
  to: number
}

export interface IncrementalParseReport {
  mode: 'full' | 'incremental' | 'mapped'
  ranges: readonly DirtyRegion[]
  lines: ReadonlyArray<{ start: number; end: number }>
}

export interface IncrementalParseState {
  getDirtyRanges(windowFrom: number, windowTo: number): readonly DirtyRegion[]
  cleanRange(from: number, to: number): void
  clear(): void
}

type IncrementalParseReporter = ((report: IncrementalParseReport) => void) | null

let incrementalParseReporter: IncrementalParseReporter = null

export function setIncrementalParseReporter(reporter: IncrementalParseReporter) {
  incrementalParseReporter = reporter
}

export function reportIncrementalParse(report: IncrementalParseReport) {
  incrementalParseReporter?.(report)

  const debugTarget = globalThis as typeof globalThis & {
    __MARKFLOW_INCREMENTAL_PARSE_LOG__?: boolean
  }

  if (debugTarget.__MARKFLOW_INCREMENTAL_PARSE_LOG__) {
    const summary =
      report.lines.length > 0
        ? report.lines.map((lineRange) => `${lineRange.start}-${lineRange.end}`).join(', ')
        : 'no visible dirty ranges'
    console.info(`[markflow incremental-parse] ${report.mode}: ${summary}`)
  }
}

/** Merge overlapping dirty regions so decoration work stays bounded. */
export function mergeDirtyRegions(regions: ReadonlyArray<DirtyRegion>): DirtyRegion[] {
  if (regions.length === 0) {
    return []
  }

  const sorted = [...regions]
    .filter((region) => region.from <= region.to)
    .sort((left, right) => left.from - right.from || left.to - right.to)

  if (sorted.length === 0) {
    return []
  }

  const merged: DirtyRegion[] = [{ ...sorted[0] }]
  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index]
    const last = merged[merged.length - 1]

    if (current.from <= last.to) {
      last.to = Math.max(last.to, current.to)
      continue
    }

    merged.push({ ...current })
  }

  return merged
}

/** View plugin that tracks the document regions touched by recent edits. */
export const incrementalParsePlugin = ViewPlugin.fromClass(
  class implements IncrementalParseState {
    dirtyRanges: DirtyRegion[] = []

    update(update: ViewUpdate) {
      if (!update.docChanged) {
        return
      }

      const ranges: DirtyRegion[] = []
      update.changes.iterChangedRanges((_oldFrom, _oldTo, newFrom, newTo) => {
        ranges.push({ from: newFrom, to: newTo })
      })

      this.dirtyRanges = mergeDirtyRegions([...this.dirtyRanges, ...ranges])
    }

    getDirtyRanges(windowFrom: number, windowTo: number): readonly DirtyRegion[] {
      if (this.dirtyRanges.length === 0) {
        return []
      }

      const result: DirtyRegion[] = []
      for (const region of this.dirtyRanges) {
        const overlapFrom = Math.max(region.from, windowFrom)
        const overlapTo = Math.min(region.to, windowTo)
        if (overlapFrom <= overlapTo) {
          result.push({ from: overlapFrom, to: overlapTo })
        }
      }

      return mergeDirtyRegions(result)
    }

    cleanRange(from: number, to: number) {
      if (this.dirtyRanges.length === 0) {
        return
      }

      const next: DirtyRegion[] = []
      for (const region of this.dirtyRanges) {
        if (region.to < from || region.from > to) {
          next.push(region)
        } else if (region.from < from && region.to > to) {
          next.push({ from: region.from, to: from })
          next.push({ from: to, to: region.to })
        } else if (region.from < from) {
          next.push({ from: region.from, to: from })
        } else if (region.to > to) {
          next.push({ from: to, to: region.to })
        }
      }

      this.dirtyRanges = mergeDirtyRegions(next)
    }

    clear() {
      this.dirtyRanges = []
    }
  },
)
