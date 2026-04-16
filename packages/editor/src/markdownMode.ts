import { markdownLanguage } from '@codemirror/lang-markdown'
import {
  type BlockContext,
  type BlockParser,
  Line,
  type MarkdownExtension,
  type MarkdownParser,
} from '@lezer/markdown'

export const MARKDOWN_MODE_STORAGE_KEY = 'markflow.markdown-mode.v1'
export const DEFAULT_MARKDOWN_MODE: MarkFlowMarkdownMode = 'tolerant'

export type MarkFlowMarkdownMode = 'tolerant' | 'strict'

type PersistedMarkdownModeState = {
  mode?: MarkFlowMarkdownMode
}

type LooseStorage = Storage & Record<string, unknown>
type InternalCompositeBlock = {
  type: number
  value: number
}

type InternalBlockContext = BlockContext & {
  stack?: InternalCompositeBlock[]
}

const fallbackStorage = new Map<string, string>()
const parserCache = new Map<MarkFlowMarkdownMode, MarkdownParser>()
const extensionCache = new Map<MarkFlowMarkdownMode, MarkdownExtension>()

function isWhitespace(charCode: number) {
  return charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13
}

function skipSpaceBack(line: string, from: number, to: number) {
  let index = from
  while (index > to && isWhitespace(line.charCodeAt(index - 1))) {
    index -= 1
  }
  return index
}

function getStoredValue(storage: LooseStorage, key: string) {
  try {
    if (typeof storage.getItem === 'function') {
      const value = storage.getItem(key)
      if (value != null) {
        fallbackStorage.set(key, value)
      }
      return value ?? fallbackStorage.get(key) ?? null
    }
  } catch {
    return fallbackStorage.get(key) ?? null
  }

  return fallbackStorage.get(key) ?? null
}

function setStoredValue(storage: LooseStorage, key: string, value: string) {
  try {
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, value)
    }
  } catch {
    // Fall back to in-memory persistence for constrained test environments.
  }

  fallbackStorage.set(key, value)
}

export function loadLocalMarkdownModePreference(): MarkFlowMarkdownMode {
  if (typeof window === 'undefined') {
    return DEFAULT_MARKDOWN_MODE
  }

  try {
    const raw = getStoredValue(window.localStorage, MARKDOWN_MODE_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_MARKDOWN_MODE
    }

    const parsed = JSON.parse(raw) as PersistedMarkdownModeState
    return parsed.mode === 'strict' ? 'strict' : DEFAULT_MARKDOWN_MODE
  } catch {
    return DEFAULT_MARKDOWN_MODE
  }
}

export function persistLocalMarkdownModePreference(mode: MarkFlowMarkdownMode) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState: PersistedMarkdownModeState = { mode }
  setStoredValue(window.localStorage, MARKDOWN_MODE_STORAGE_KEY, JSON.stringify(nextState))
}

export function formatMarkdownModeStatus(mode: MarkFlowMarkdownMode) {
  return mode === 'strict' ? 'Markdown: Strict' : 'Markdown: Tolerant'
}

function matchOrderedList(line: Line) {
  let position = line.pos
  let next = line.next

  for (;;) {
    if (next >= 48 && next <= 57) {
      position += 1
    } else {
      break
    }

    if (position === line.text.length) {
      return -1
    }

    next = line.text.charCodeAt(position)
  }

  if (
    position === line.pos ||
    position > line.pos + 9 ||
    (next !== 46 && next !== 41) ||
    (position < line.text.length - 1 && !isWhitespace(line.text.charCodeAt(position + 1)))
  ) {
    return -1
  }

  return position + 1 - line.pos
}

function matchBulletList(line: Line) {
  return (line.next === 45 || line.next === 43 || line.next === 42) &&
    (line.pos === line.text.length - 1 || isWhitespace(line.text.charCodeAt(line.pos + 1)))
    ? 1
    : -1
}

function matchAtxHeading(line: Line, tolerant: boolean) {
  if (line.next !== 35) {
    return { markerSize: -1, contentFrom: -1 }
  }

  let position = line.pos + 1
  while (position < line.text.length && line.text.charCodeAt(position) === 35) {
    position += 1
  }

  const markerSize = position - line.pos
  if (markerSize > 6) {
    return { markerSize: -1, contentFrom: -1 }
  }

  const hasRequiredWhitespace =
    position >= line.text.length || isWhitespace(line.text.charCodeAt(position))
  if (!tolerant && !hasRequiredWhitespace) {
    return { markerSize: -1, contentFrom: -1 }
  }

  return {
    markerSize,
    contentFrom:
      position < line.text.length && isWhitespace(line.text.charCodeAt(position))
        ? position + 1
        : position,
  }
}

function getListContentIndent(line: Line, markerEnd: number) {
  const indentAfterMarker = line.countIndent(markerEnd, line.pos, line.indent)
  const indentedContent = line.countIndent(line.skipSpace(markerEnd), markerEnd, indentAfterMarker)
  return indentedContent >= indentAfterMarker + 5 ? indentAfterMarker + 1 : indentedContent
}

function getContinuationIndent(
  mode: MarkFlowMarkdownMode,
  line: Line,
  contentIndent: number,
) {
  if (mode === 'strict') {
    return contentIndent
  }

  return Math.min(contentIndent, line.baseIndent + 2)
}

function createListParser(
  mode: MarkFlowMarkdownMode,
  listName: 'OrderedList' | 'BulletList',
): BlockParser {
  return {
    name: listName,
    parse(cx, line) {
      const markerSize = listName === 'OrderedList' ? matchOrderedList(line) : matchBulletList(line)
      if (markerSize < 0) {
        return false
      }

      const listValue =
        listName === 'OrderedList'
          ? line.text.charCodeAt(line.pos + markerSize - 1)
          : line.next

      cx.startComposite(listName, line.basePos, listValue)

      const contentIndent = getListContentIndent(line, line.pos + markerSize)
      const continuationIndent = getContinuationIndent(mode, line, contentIndent)

      cx.startComposite('ListItem', line.basePos, continuationIndent - line.baseIndent)
      cx.addElement(
        cx.elt('ListMark', cx.lineStart + line.pos, cx.lineStart + line.pos + markerSize),
      )
      line.moveBaseColumn(contentIndent)

      return null
    },
    endLeaf(cx, line) {
      if (mode !== 'strict' || line.pos === line.text.length || line.next < 0) {
        return false
      }

      const stack = (cx as InternalBlockContext).stack
      if (!Array.isArray(stack)) {
        return false
      }

      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const block = stack[index]
        const typeName = cx.parser.nodeSet.types[block.type]?.name
        if (typeName === 'ListItem') {
          return line.indent < line.baseIndent + block.value
        }
      }

      return false
    },
  }
}

function createTolerantAtxHeadingParser(): BlockParser {
  return {
    name: 'ATXHeading',
    parse(cx, line) {
      const { markerSize, contentFrom } = matchAtxHeading(line, true)
      if (markerSize < 0) {
        return false
      }

      const markerFrom = cx.lineStart + line.pos
      const lineEnd = cx.lineStart + line.text.length
      const trimmedLineEnd = skipSpaceBack(line.text, line.text.length, line.pos)
      let closingMarkerStart = trimmedLineEnd

      while (
        closingMarkerStart > line.pos &&
        line.text.charCodeAt(closingMarkerStart - 1) === line.next
      ) {
        closingMarkerStart -= 1
      }

      if (
        closingMarkerStart === trimmedLineEnd ||
        closingMarkerStart === line.pos ||
        !isWhitespace(line.text.charCodeAt(closingMarkerStart - 1))
      ) {
        closingMarkerStart = line.text.length
      }

      const children = [
        cx.elt('HeaderMark', markerFrom, markerFrom + markerSize),
        ...cx.parser.parseInline(
          line.text.slice(contentFrom, closingMarkerStart),
          cx.lineStart + contentFrom,
        ),
      ]

      if (closingMarkerStart < line.text.length) {
        children.push(
          cx.elt(
            'HeaderMark',
            cx.lineStart + closingMarkerStart,
            cx.lineStart + trimmedLineEnd,
          ),
        )
      }

      cx.nextLine()
      cx.addElement(cx.elt(`ATXHeading${markerSize}`, markerFrom, lineEnd, children))

      return true
    },
  }
}

export function getMarkdownModeExtensions(mode: MarkFlowMarkdownMode): MarkdownExtension {
  const cached = extensionCache.get(mode)
  if (cached) {
    return cached
  }

  const extensions: MarkdownExtension = {
    parseBlock: [
      createListParser(mode, 'BulletList'),
      createListParser(mode, 'OrderedList'),
      ...(mode === 'tolerant' ? [createTolerantAtxHeadingParser()] : []),
    ],
  }

  extensionCache.set(mode, extensions)
  return extensions
}

export function getMarkdownParser(mode: MarkFlowMarkdownMode): MarkdownParser {
  const cached = parserCache.get(mode)
  if (cached) {
    return cached
  }

  const parser = (markdownLanguage.parser as MarkdownParser).configure(getMarkdownModeExtensions(mode))
  parserCache.set(mode, parser)
  return parser
}
