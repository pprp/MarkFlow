import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export const VIRTUAL_RENDER_LINE_THRESHOLD = 5000
export const VIRTUAL_RENDER_LINE_BUFFER = 200

interface VisibleRangeLike {
  from: number
  to: number
}

interface ViewportWindowSource {
  state: { doc: Text }
  visibleRanges: readonly VisibleRangeLike[]
}

export interface DecorationViewportWindow {
  from: number
  to: number
  startLine: number
  endLine: number
  lineCount: number
  virtualized: boolean
}

function buildFullDocumentWindow(doc: Text): DecorationViewportWindow {
  return {
    from: 0,
    to: doc.length,
    startLine: 1,
    endLine: doc.lines,
    lineCount: doc.lines,
    virtualized: false,
  }
}

export function getDecorationViewportWindow(
  view: Pick<EditorView, 'state' | 'visibleRanges'> | ViewportWindowSource,
  bufferLines = VIRTUAL_RENDER_LINE_BUFFER,
): DecorationViewportWindow {
  const doc = view.state.doc
  if (doc.lines <= VIRTUAL_RENDER_LINE_THRESHOLD || view.visibleRanges.length === 0) {
    return buildFullDocumentWindow(doc)
  }

  const firstVisible = view.visibleRanges[0]
  const lastVisible = view.visibleRanges[view.visibleRanges.length - 1]
  const visibleStartLine = doc.lineAt(firstVisible.from).number
  const visibleEndLine = doc.lineAt(lastVisible.to).number
  const startLine = Math.max(1, visibleStartLine - bufferLines)
  const endLine = Math.min(doc.lines, visibleEndLine + bufferLines)

  return {
    from: doc.line(startLine).from,
    to: doc.line(endLine).to,
    startLine,
    endLine,
    lineCount: endLine - startLine + 1,
    virtualized: true,
  }
}
