import { Transaction } from '@codemirror/state'
import type { EditorState } from '@codemirror/state'
import { foldEffect, foldable, foldedRanges, unfoldEffect } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'

function getRangeKey(from: number, to: number) {
  return `${from}:${to}`
}

export function getCollapsedRanges(state: EditorState): number[] {
  const ranges: number[] = []
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    ranges.push(from, to)
  })
  return ranges
}

export function areCollapsedRangesEqual(
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined,
) {
  if (left === right) {
    return true
  }

  if (!left || !right || left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

export function getAvailableCollapsedRanges(state: EditorState): number[] {
  const ranges: number[] = []
  const seen = new Set<string>()

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const range = foldable(state, line.from, line.to)
    if (!range) {
      continue
    }

    const key = getRangeKey(range.from, range.to)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    ranges.push(range.from, range.to)
  }

  return ranges
}

export function normalizeCollapsedRanges(
  state: EditorState,
  ranges: readonly number[] | null | undefined,
) {
  if (!ranges || ranges.length === 0) {
    return []
  }

  const allowed = new Set<string>()
  for (const [from, to] of getRangePairs(getAvailableCollapsedRanges(state))) {
    allowed.add(getRangeKey(from, to))
  }

  const normalized: number[] = []
  const seen = new Set<string>()
  for (const [from, to] of getRangePairs(ranges)) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= to) {
      continue
    }

    const key = getRangeKey(from, to)
    if (!allowed.has(key) || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalized.push(from, to)
  }

  return normalized
}

export function applyCollapsedRanges(view: EditorView, ranges: readonly number[] | null | undefined) {
  const nextRanges = normalizeCollapsedRanges(view.state, ranges)
  const currentRanges = getCollapsedRanges(view.state)

  if (areCollapsedRangesEqual(currentRanges, nextRanges)) {
    return false
  }

  const effects = [
    ...getRangePairs(currentRanges).map(([from, to]) => unfoldEffect.of({ from, to })),
    ...getRangePairs(nextRanges).map(([from, to]) => foldEffect.of({ from, to })),
  ]

  if (effects.length === 0) {
    return false
  }

  view.dispatch({
    effects,
    annotations: Transaction.addToHistory.of(false),
  })
  return true
}

function getRangePairs(ranges: readonly number[]) {
  const pairs: Array<[number, number]> = []

  for (let index = 0; index + 1 < ranges.length; index += 2) {
    pairs.push([ranges[index], ranges[index + 1]])
  }

  return pairs
}
