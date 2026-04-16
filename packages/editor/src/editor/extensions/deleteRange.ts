import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { EditorView, type KeyBinding, keymap } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { findInnermostFormatWrapper } from '../clearFormatting'
import { deleteTableRow } from './tableCommands'

const HEADING_NODE_RE = /^ATXHeading[1-6]$/
const MULTI_LINE_MATH_DELIMITERS = [
  { open: '$$', close: '$$' },
  { open: '\\[', close: '\\]' },
] as const
const SINGLE_LINE_BLOCK_MATH_PATTERNS = [
  /^\s*\$\$([^$\n]+?)\$\$\s*$/,
  /^\s*\\\[([^\n]+?)\\\]\s*$/,
]
const SENTENCE_END_RE = /[.!?]/
const SENTENCE_CLOSER_RE = /[)"'\]]/

interface DeleteRangeOptions {
  isWysiwygMode?: () => boolean
}

interface StructuralContext {
  blockquote: SyntaxNode | null
  codeBlock: SyntaxNode | null
  heading: SyntaxNode | null
  listItem: SyntaxNode | null
  paragraph: SyntaxNode | null
  table: SyntaxNode | null
}

interface MathBlockContext {
  endLine: number
  from: number
  startLine: number
  to: number
}

function isDeleteRangeEnabled(options?: DeleteRangeOptions) {
  return options?.isWysiwygMode ? options.isWysiwygMode() : true
}

function applyDeletion(view: EditorView, from: number, to: number, anchor = from) {
  if (from >= to) {
    return false
  }

  view.dispatch({
    changes: { from, to },
    selection: { anchor: Math.max(0, anchor) },
    scrollIntoView: true,
  })
  return true
}

function resolveStructuralContext(view: EditorView): StructuralContext {
  const { state } = view
  const selection = state.selection.main
  const positions = state.doc.length === 0
    ? [0]
    : Array.from(new Set([selection.head, Math.max(0, selection.head - 1)]))

  for (const position of positions) {
    const tree = ensureSyntaxTree(state, position, 100) ?? syntaxTree(state)
    let node: SyntaxNode | null = tree.resolveInner(position, -1)
    const context: StructuralContext = {
      blockquote: null,
      codeBlock: null,
      heading: null,
      listItem: null,
      paragraph: null,
      table: null,
    }

    while (node) {
      if (!context.table && node.name === 'Table') {
        context.table = node
      } else if (!context.codeBlock && (node.name === 'FencedCode' || node.name === 'CodeBlock')) {
        context.codeBlock = node
      } else if (!context.listItem && node.name === 'ListItem') {
        context.listItem = node
      } else if (!context.heading && HEADING_NODE_RE.test(node.name)) {
        context.heading = node
      } else if (!context.paragraph && node.name === 'Paragraph') {
        context.paragraph = node
      } else if (!context.blockquote && node.name === 'Blockquote') {
        context.blockquote = node
      }

      node = node.parent
    }

    if (Object.values(context).some(Boolean)) {
      return context
    }
  }

  return {
    blockquote: null,
    codeBlock: null,
    heading: null,
    listItem: null,
    paragraph: null,
    table: null,
  }
}

function collectCodeRanges(view: EditorView) {
  const ranges: Array<{ from: number; to: number }> = []

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
        ranges.push({ from: node.from, to: node.to })
        return false
      }
    },
  })

  return ranges
}

function overlapsAny(
  from: number,
  to: number,
  ranges: ReadonlyArray<{ from: number; to: number }>,
) {
  return ranges.some((range) => from < range.to && to > range.from)
}

function findEnclosingMathBlock(view: EditorView): MathBlockContext | null {
  const { state } = view
  const selection = state.selection.main
  if (!selection.empty) {
    return null
  }

  const codeRanges = collectCodeRanges(view)
  let openBlock: { from: number; startLine: number; closeDelimiter: string } | null = null

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    if (overlapsAny(line.from, line.to, codeRanges)) {
      continue
    }

    const trimmed = line.text.trim()
    if (!openBlock) {
      if (selection.head >= line.from && selection.head <= line.to) {
        const singleLineMatch = SINGLE_LINE_BLOCK_MATH_PATTERNS.some((pattern) => pattern.test(line.text))
        if (singleLineMatch) {
          return {
            from: line.from,
            to: line.to,
            startLine: lineNumber,
            endLine: lineNumber,
          }
        }
      }

      const delimiter = MULTI_LINE_MATH_DELIMITERS.find((candidate) => trimmed === candidate.open)
      if (delimiter) {
        openBlock = {
          from: line.from,
          startLine: lineNumber,
          closeDelimiter: delimiter.close,
        }
      }
      continue
    }

    if (trimmed !== openBlock.closeDelimiter) {
      continue
    }

    const block = {
      from: openBlock.from,
      to: line.to,
      startLine: openBlock.startLine,
      endLine: lineNumber,
    }

    if (selection.head >= block.from && selection.head <= block.to) {
      return block
    }

    openBlock = null
  }

  return null
}

function buildLineDeletionRange(view: EditorView, lineNumber: number) {
  const { doc } = view.state
  const line = doc.line(lineNumber)

  if (doc.lines === 1) {
    return { from: line.from, to: line.to, anchor: line.from }
  }

  if (lineNumber < doc.lines) {
    return {
      from: line.from,
      to: doc.line(lineNumber + 1).from,
      anchor: line.from,
    }
  }

  return {
    from: doc.line(lineNumber - 1).to,
    to: line.to,
    anchor: doc.line(lineNumber - 1).to,
  }
}

function buildWholeLineRange(view: EditorView, startLine: number, endLine: number) {
  const { doc } = view.state

  if (endLine < doc.lines) {
    return {
      from: doc.line(startLine).from,
      to: doc.line(endLine + 1).from,
      anchor: doc.line(startLine).from,
    }
  }

  if (startLine > 1) {
    return {
      from: doc.line(startLine - 1).to,
      to: doc.line(endLine).to,
      anchor: doc.line(startLine - 1).to,
    }
  }

  return {
    from: doc.line(startLine).from,
    to: doc.line(endLine).to,
    anchor: doc.line(startLine).from,
  }
}

function adjustBlockLineRange(view: EditorView, startLine: number, endLine: number) {
  const { doc } = view.state
  let nextStartLine = startLine
  let nextEndLine = endLine

  if (endLine < doc.lines && doc.line(endLine + 1).text.trim().length === 0) {
    nextEndLine += 1
  } else if (startLine > 1 && doc.line(startLine - 1).text.trim().length === 0) {
    nextStartLine -= 1
  }

  return { startLine: nextStartLine, endLine: nextEndLine }
}

function isSentenceBoundary(text: string, index: number) {
  if (!SENTENCE_END_RE.test(text[index] ?? '')) {
    return false
  }

  const next = text[index + 1]
  return next == null || /\s/.test(next)
}

function findSentenceDeletionRange(text: string, offset: number) {
  let index = 0

  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1
    }

    if (index >= text.length) {
      break
    }

    const sentenceFrom = index
    let sentenceTo = index

    while (sentenceTo < text.length) {
      if (text[sentenceTo] === '\n') {
        break
      }

      if (isSentenceBoundary(text, sentenceTo)) {
        sentenceTo += 1
        while (sentenceTo < text.length && SENTENCE_CLOSER_RE.test(text[sentenceTo])) {
          sentenceTo += 1
        }
        break
      }

      sentenceTo += 1
    }

    let deleteFrom = sentenceFrom
    let deleteTo = sentenceTo

    if (deleteTo < text.length) {
      while (deleteTo < text.length && /\s/.test(text[deleteTo])) {
        deleteTo += 1
      }
    } else {
      while (deleteFrom > 0 && /\s/.test(text[deleteFrom - 1])) {
        deleteFrom -= 1
      }
    }

    if (offset >= sentenceFrom && offset <= sentenceTo) {
      return { from: deleteFrom, to: deleteTo }
    }

    index = sentenceTo
  }

  return null
}

export function deleteWord(view: EditorView, options?: DeleteRangeOptions) {
  if (!isDeleteRangeEnabled(options)) {
    return false
  }

  const selection = view.state.selection.main
  if (!selection.empty) {
    return false
  }

  const word = view.state.wordAt(selection.head)
    ?? (selection.head > 0 ? view.state.wordAt(selection.head - 1) : null)

  if (!word) {
    return false
  }

  return applyDeletion(view, word.from, word.to)
}

export function deleteLineOrSentence(view: EditorView, options?: DeleteRangeOptions) {
  if (!isDeleteRangeEnabled(options)) {
    return false
  }

  const selection = view.state.selection.main
  if (!selection.empty) {
    return false
  }

  const context = resolveStructuralContext(view)
  const mathBlock = findEnclosingMathBlock(view)
  const currentLine = view.state.doc.lineAt(selection.head)

  if (context.table) {
    return deleteTableRow(view, options)
  }

  if (context.codeBlock || mathBlock) {
    const range = buildLineDeletionRange(view, currentLine.number)
    return applyDeletion(view, range.from, range.to, range.anchor)
  }

  if (currentLine.text.trim().length === 0) {
    const range = buildLineDeletionRange(view, currentLine.number)
    return applyDeletion(view, range.from, range.to, range.anchor)
  }

  if (context.paragraph) {
    const text = view.state.doc.sliceString(context.paragraph.from, context.paragraph.to)
    const relativeOffset = selection.head - context.paragraph.from
    const sentence = findSentenceDeletionRange(text, relativeOffset)
    if (!sentence) {
      return false
    }

    return applyDeletion(
      view,
      context.paragraph.from + sentence.from,
      context.paragraph.from + sentence.to,
    )
  }

  if (context.heading || context.listItem || context.blockquote) {
    const range = buildLineDeletionRange(view, currentLine.number)
    return applyDeletion(view, range.from, range.to, range.anchor)
  }

  return false
}

export function deleteBlock(view: EditorView, options?: DeleteRangeOptions) {
  if (!isDeleteRangeEnabled(options)) {
    return false
  }

  const selection = view.state.selection.main
  if (!selection.empty) {
    return false
  }

  const context = resolveStructuralContext(view)
  const mathBlock = findEnclosingMathBlock(view)
  const target =
    context.table
    ?? context.codeBlock
    ?? mathBlock
    ?? context.listItem
    ?? context.heading
    ?? context.paragraph
    ?? context.blockquote

  if (!target) {
    return false
  }

  const startLine = view.state.doc.lineAt(target.from).number
  const endLine = view.state.doc.lineAt(target.to).number
  const lines = adjustBlockLineRange(view, startLine, endLine)
  const range = buildWholeLineRange(view, lines.startLine, lines.endLine)

  return applyDeletion(view, range.from, range.to, range.anchor)
}

export function deleteStyledScope(view: EditorView, options?: DeleteRangeOptions) {
  if (!isDeleteRangeEnabled(options)) {
    return false
  }

  const selection = view.state.selection.main
  if (!selection.empty) {
    return false
  }

  const wrapper = findInnermostFormatWrapper(view.state, selection.head)
  if (!wrapper) {
    return false
  }

  return applyDeletion(view, wrapper.openFrom, wrapper.closeTo)
}

function buildDeleteRangeKeymap(options?: DeleteRangeOptions): KeyBinding[] {
  return [
    {
      key: 'Mod-Shift-d',
      preventDefault: true,
      run: (view) => deleteWord(view, options),
    },
    {
      key: 'Mod-Shift-Backspace',
      preventDefault: true,
      run: (view) => deleteLineOrSentence(view, options),
    },
    {
      key: 'Mod-Shift-e',
      preventDefault: true,
      run: (view) => deleteStyledScope(view, options),
    },
  ]
}

export function deleteRangeExtension(options?: DeleteRangeOptions) {
  return Prec.highest(keymap.of(buildDeleteRangeKeymap(options)))
}
