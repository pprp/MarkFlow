import type { EditorState } from '@codemirror/state'
import { SearchQuery } from '@codemirror/search'

export type DocumentSearchMatch = {
  from: number
  to: number
}

type SearchCursorLike = {
  next: () => SearchCursorLike
  done: boolean
  value: {
    from: number
    to: number
  }
}

const FUZZY_GAP = '[^\\n]*?'
const WHITESPACE_GAP = '[^\\S\\n]+'
const REGEXP_FLAGS = 'gi'

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeFuzzyQuery(rawQuery: string) {
  return rawQuery.trim()
}

export function buildFuzzySearchPattern(rawQuery: string) {
  const normalizedQuery = normalizeFuzzyQuery(rawQuery)
  if (!normalizedQuery) {
    return null
  }

  const segments: string[] = []
  let needsWhitespaceGap = false

  for (const character of Array.from(normalizedQuery)) {
    if (/\s/u.test(character)) {
      needsWhitespaceGap = segments.length > 0
      continue
    }

    if (segments.length > 0) {
      segments.push(needsWhitespaceGap ? WHITESPACE_GAP : FUZZY_GAP)
    }

    segments.push(escapeRegExp(character))
    needsWhitespaceGap = false
  }

  return segments.length > 0 ? segments.join('') : null
}

export function createFuzzySearchQuery(rawQuery: string) {
  const pattern = buildFuzzySearchPattern(rawQuery)
  if (!pattern) {
    return null
  }

  return new SearchQuery({
    search: pattern,
    regexp: true,
  })
}

function createFuzzySearchRegExp(rawQuery: string) {
  const pattern = buildFuzzySearchPattern(rawQuery)
  return pattern ? new RegExp(pattern, REGEXP_FLAGS) : null
}

export function countFuzzySearchMatches(content: string, rawQuery: string) {
  const regex = createFuzzySearchRegExp(rawQuery)
  if (!regex) {
    return 0
  }

  let count = 0
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(content)) !== null) {
    count += 1
    if (match[0].length === 0) {
      regex.lastIndex += 1
    }
  }

  return count
}

export function collectFuzzySearchMatches(
  state: EditorState,
  query: SearchQuery,
  from: number,
  to: number,
) {
  const matches: DocumentSearchMatch[] = []
  const cursor = query.getCursor(state, from, to) as SearchCursorLike

  while (!cursor.next().done) {
    matches.push({
      from: cursor.value.from,
      to: cursor.value.to,
    })
  }

  return matches
}

export function findNextFuzzySearchMatch(
  state: EditorState,
  query: SearchQuery,
  currentTo: number,
) {
  const nextCursor = query.getCursor(state, currentTo, state.doc.length) as SearchCursorLike
  if (!nextCursor.next().done) {
    return {
      from: nextCursor.value.from,
      to: nextCursor.value.to,
    }
  }

  const wrappedCursor = query.getCursor(state, 0, currentTo) as SearchCursorLike
  if (!wrappedCursor.next().done) {
    return {
      from: wrappedCursor.value.from,
      to: wrappedCursor.value.to,
    }
  }

  return null
}

export function findPreviousFuzzySearchMatch(
  state: EditorState,
  query: SearchQuery,
  currentFrom: number,
) {
  let previousMatch: DocumentSearchMatch | null = null

  const previousCursor = query.getCursor(state, 0, currentFrom) as SearchCursorLike
  while (!previousCursor.next().done) {
    previousMatch = {
      from: previousCursor.value.from,
      to: previousCursor.value.to,
    }
  }

  if (previousMatch) {
    return previousMatch
  }

  const wrappedCursor = query.getCursor(state, currentFrom, state.doc.length) as SearchCursorLike
  while (!wrappedCursor.next().done) {
    previousMatch = {
      from: wrappedCursor.value.from,
      to: wrappedCursor.value.to,
    }
  }

  return previousMatch
}
