import type { SyntaxNode } from '@lezer/common'
import type { EditorState } from '@codemirror/state'
import { foldGutter, foldService, foldKeymap, syntaxTree } from '@codemirror/language'
import { keymap } from '@codemirror/view'

const HEADING_NODE_RE = /^ATXHeading([1-6])$/
const BLOCK_FOLDABLE_NODES = new Set(['Blockquote', 'BulletList', 'FencedCode', 'OrderedList'])

export function headingFoldExtension() {
  return [
    foldGutter(),
    foldService.of((state, lineStart) => {
      return getHeadingFoldRange(state, lineStart) ?? getBlockFoldRange(state, lineStart)
    }),
    keymap.of(foldKeymap),
  ]
}

function getHeadingFoldRange(state: EditorState, lineStart: number) {
  const line = state.doc.lineAt(lineStart)
  const level = getHeadingLevelAtLine(state, line.number)
  if (level === null) {
    return null
  }

  let endPos = line.to
  for (let lineNumber = line.number + 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const nextLine = state.doc.line(lineNumber)
    const nextLevel = getHeadingLevelAtLine(state, lineNumber)
    if (nextLevel !== null && nextLevel <= level) {
      endPos = state.doc.line(lineNumber - 1).to
      break
    }
    endPos = nextLine.to
  }

  if (endPos <= line.to) {
    return null
  }

  return { from: line.to, to: endPos }
}

function getBlockFoldRange(state: EditorState, lineStart: number) {
  const line = state.doc.lineAt(lineStart)
  const node = findFoldNodeStartingAt(state, line.from, (nodeName) =>
    BLOCK_FOLDABLE_NODES.has(nodeName),
  )

  if (!node || node.to <= line.to) {
    return null
  }

  return { from: line.to, to: node.to }
}

function getHeadingLevelAtLine(state: EditorState, lineNumber: number) {
  const line = state.doc.line(lineNumber)
  const node = findFoldNodeStartingAt(state, line.from, (nodeName) => HEADING_NODE_RE.test(nodeName))
  if (!node) {
    return null
  }

  const match = HEADING_NODE_RE.exec(node.type.name)
  return match ? Number(match[1]) : null
}

function findFoldNodeStartingAt(
  state: EditorState,
  lineStart: number,
  matches: (nodeName: string) => boolean,
) {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(lineStart, 1)

  while (node) {
    if (node.from !== lineStart) {
      node = node.parent
      continue
    }
    if (matches(node.type.name)) {
      return node
    }

    node = node.parent
  }

  return null
}
