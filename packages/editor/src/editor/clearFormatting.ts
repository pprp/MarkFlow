import type { ChangeSpec, EditorState, SelectionRange } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

export interface FormatWrapper {
  closeFrom: number
  closeText: string
  closeTo: number
  contentFrom: number
  contentTo: number
  depth: number
  openFrom: number
  openText: string
  openTo: number
}

interface InsertChange {
  depth: number
  text: string
}

const highlightPattern = /==([^=\n](?:.*?[^=\n])?)==/g
const underlinePattern = /<u>([\s\S]+?)<\/u>/g

function rangeIntersects(selection: SelectionRange, wrapper: FormatWrapper) {
  return selection.to > wrapper.contentFrom && selection.from < wrapper.contentTo
}

function collectCodeRanges(state: EditorState) {
  const ranges: Array<{ from: number; to: number }> = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
        ranges.push({ from: node.from, to: node.to })
      }
    },
  })

  return ranges
}

function overlapsCodeRanges(from: number, to: number, codeRanges: ReadonlyArray<{ from: number; to: number }>) {
  return codeRanges.some((range) => from < range.to && to > range.from)
}

function buildDelimitedWrapper(
  from: number,
  to: number,
  openLength: number,
  closeLength: number,
  source: string,
): FormatWrapper | null {
  const contentFrom = from + openLength
  const contentTo = to - closeLength
  if (contentFrom >= contentTo) {
    return null
  }

  return {
    openFrom: from,
    openTo: contentFrom,
    closeFrom: contentTo,
    closeTo: to,
    contentFrom,
    contentTo,
    openText: source.slice(0, openLength),
    closeText: source.slice(source.length - closeLength),
    depth: 0,
  }
}

function buildLinkWrapper(from: number, to: number, source: string): FormatWrapper | null {
  if (!source.startsWith('[')) {
    return null
  }

  let labelEnd = -1
  let bracketDepth = 0

  for (let index = 1; index < source.length - 1; index += 1) {
    const char = source[index]
    if (char === '\\') {
      index += 1
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char !== ']') {
      continue
    }

    if (bracketDepth === 0 && source[index + 1] === '(') {
      labelEnd = index
      break
    }

    bracketDepth = Math.max(0, bracketDepth - 1)
  }

  if (labelEnd <= 1) {
    return null
  }

  return {
    openFrom: from,
    openTo: from + 1,
    closeFrom: from + labelEnd,
    closeTo: to,
    contentFrom: from + 1,
    contentTo: from + labelEnd,
    openText: '[',
    closeText: source.slice(labelEnd),
    depth: 0,
  }
}

function collectTreeWrappers(state: EditorState) {
  const wrappers: FormatWrapper[] = []

  syntaxTree(state).iterate({
    enter(node) {
      const source = state.doc.sliceString(node.from, node.to)

      if (node.name === 'StrongEmphasis') {
        const wrapper = buildDelimitedWrapper(node.from, node.to, 2, 2, source)
        if (wrapper) {
          wrappers.push(wrapper)
        }
        return
      }

      if (node.name === 'Emphasis') {
        const wrapper = buildDelimitedWrapper(node.from, node.to, 1, 1, source)
        if (wrapper) {
          wrappers.push(wrapper)
        }
        return
      }

      if (node.name === 'Strikethrough') {
        const wrapper = buildDelimitedWrapper(node.from, node.to, 2, 2, source)
        if (wrapper) {
          wrappers.push(wrapper)
        }
        return
      }

      if (node.name === 'InlineCode') {
        const openLength = source.match(/^`+/)?.[0].length ?? 0
        const closeLength = source.match(/`+$/)?.[0].length ?? 0
        const wrapper = buildDelimitedWrapper(node.from, node.to, openLength, closeLength, source)
        if (wrapper) {
          wrappers.push(wrapper)
        }
        return
      }

      if (node.name === 'Link') {
        const wrapper = buildLinkWrapper(node.from, node.to, source)
        if (wrapper) {
          wrappers.push(wrapper)
        }
      }
    },
  })

  return wrappers
}

function collectPatternWrappers(
  state: EditorState,
  pattern: RegExp,
  openText: string,
  closeText: string,
  codeRanges: ReadonlyArray<{ from: number; to: number }>,
) {
  const wrappers: FormatWrapper[] = []
  const source = state.doc.toString()
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    const from = match.index
    const to = from + match[0].length
    if (overlapsCodeRanges(from, to, codeRanges)) {
      continue
    }

    const wrapper = buildDelimitedWrapper(from, to, openText.length, closeText.length, match[0])
    if (wrapper) {
      wrappers.push(wrapper)
    }
  }

  return wrappers
}

function assignWrapperDepths(wrappers: FormatWrapper[]) {
  for (const wrapper of wrappers) {
    wrapper.depth = wrappers.filter((other) => {
      if (other === wrapper) {
        return false
      }

      const containsContent =
        other.contentFrom <= wrapper.contentFrom && other.contentTo >= wrapper.contentTo
      const strictlyContains =
        other.contentFrom < wrapper.contentFrom ||
        other.contentTo > wrapper.contentTo ||
        other.openFrom < wrapper.openFrom ||
        other.closeTo > wrapper.closeTo

      return containsContent && strictlyContains
    }).length
  }
}

function collectWrappers(state: EditorState) {
  const codeRanges = collectCodeRanges(state)
  const wrappers = [
    ...collectTreeWrappers(state),
    ...collectPatternWrappers(state, highlightPattern, '==', '==', codeRanges),
    ...collectPatternWrappers(state, underlinePattern, '<u>', '</u>', codeRanges),
  ]
  assignWrapperDepths(wrappers)
  return wrappers
}

export function findInnermostFormatWrapper(state: EditorState, position: number) {
  return collectWrappers(state)
    .filter((wrapper) => position >= wrapper.openFrom && position <= wrapper.closeTo)
    .sort((left, right) => right.depth - left.depth)[0] ?? null
}

function addInsert(map: Map<number, InsertChange[]>, position: number, change: InsertChange) {
  const existing = map.get(position)
  if (existing) {
    existing.push(change)
    return
  }

  map.set(position, [change])
}

function pushDelete(changes: ChangeSpec[], from: number, to: number) {
  if (from < to) {
    changes.push({ from, to })
  }
}

function buildInsertChanges(map: Map<number, InsertChange[]>, direction: 'open' | 'close'): ChangeSpec[] {
  return [...map.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([from, inserts]) => ({
      from,
      insert: inserts
        .sort((left, right) =>
          direction === 'close' ? right.depth - left.depth : left.depth - right.depth,
        )
        .map((insert) => insert.text)
        .join(''),
    }))
}

export function buildClearFormattingChanges(
  state: EditorState,
  selection: SelectionRange = state.selection.main,
) {
  if (selection.empty) {
    return []
  }

  const changes: ChangeSpec[] = []
  const closeInserts = new Map<number, InsertChange[]>()
  const openInserts = new Map<number, InsertChange[]>()

  for (const wrapper of collectWrappers(state)) {
    if (!rangeIntersects(selection, wrapper)) {
      continue
    }

    const clearsPrefix = selection.from <= wrapper.contentFrom
    const clearsSuffix = selection.to >= wrapper.contentTo

    if (clearsPrefix && clearsSuffix) {
      pushDelete(changes, wrapper.openFrom, wrapper.openTo)
      pushDelete(changes, wrapper.closeFrom, wrapper.closeTo)
      continue
    }

    if (clearsPrefix) {
      pushDelete(changes, wrapper.openFrom, wrapper.openTo)
      addInsert(openInserts, selection.to, { depth: wrapper.depth, text: wrapper.openText })
      continue
    }

    if (clearsSuffix) {
      addInsert(closeInserts, selection.from, { depth: wrapper.depth, text: wrapper.closeText })
      pushDelete(changes, wrapper.closeFrom, wrapper.closeTo)
      continue
    }

    addInsert(closeInserts, selection.from, { depth: wrapper.depth, text: wrapper.closeText })
    addInsert(openInserts, selection.to, { depth: wrapper.depth, text: wrapper.openText })
  }

  return [...changes, ...buildInsertChanges(closeInserts, 'close'), ...buildInsertChanges(openInserts, 'open')]
}

export function clearFormatting(view: EditorView) {
  const changes = buildClearFormattingChanges(view.state)
  if (changes.length === 0) {
    return false
  }

  view.dispatch({ changes })
  return true
}
