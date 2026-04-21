import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Range } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'
import {
  incrementalParsePlugin,
  mergeDirtyRegions,
  reportIncrementalParse,
  type DirtyRegion,
  type IncrementalParseState,
} from './incrementalParse'

const headingClasses: Record<string, string> = {
  ATXHeading1: 'mf-h1',
  ATXHeading2: 'mf-h2',
  ATXHeading3: 'mf-h3',
  ATXHeading4: 'mf-h4',
  ATXHeading5: 'mf-h5',
  ATXHeading6: 'mf-h6',
}

interface DecorationEntry {
  from: number
  to: number
  decoration: Decoration
  order: number
}

const highlightPattern = /==([^=\n](?:.*?[^=\n])?)==/g
const superscriptPattern = /\^([^^\n]+)\^/g
const subscriptPattern = /~([^~\n]+)~/g

function getCodeRanges(view: EditorView, from: number, to: number): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []

  syntaxTree(view.state).iterate({
    from,
    to,
    enter(node) {
      if (node.name === 'InlineCode' || node.name === 'FencedCode' || node.name === 'CodeBlock') {
        ranges.push({ from: node.from, to: node.to })
        return false
      }
    },
  })

  return ranges
}

function getNonCodeSegments(
  from: number,
  to: number,
  ranges: ReadonlyArray<{ from: number; to: number }>,
): Array<{ from: number; to: number }> {
  const segments: Array<{ from: number; to: number }> = []
  let segmentStart = from

  for (const range of ranges) {
    if (range.to <= from) {
      continue
    }
    if (range.from >= to) {
      break
    }

    if (segmentStart < range.from) {
      segments.push({ from: segmentStart, to: Math.min(range.from, to) })
    }

    segmentStart = Math.max(segmentStart, range.to)
    if (segmentStart >= to) {
      break
    }
  }

  if (segmentStart < to) {
    segments.push({ from: segmentStart, to })
  }

  return segments
}

function clampDocPosition(view: EditorView, position: number) {
  return Math.max(0, Math.min(position, view.state.doc.length))
}

function isCursorInsideInlineSpan(cursorHead: number, from: number, to: number) {
  return cursorHead >= from && cursorHead < to
}

function expandDirtyRangesToWholeLines(
  view: EditorView,
  windowFrom: number,
  windowTo: number,
  dirtyRanges: ReadonlyArray<DirtyRegion>,
): DirtyRegion[] {
  const doc = view.state.doc

  return mergeDirtyRegions(
    dirtyRanges.map((range) => {
      const boundedFrom = clampDocPosition(view, Math.max(windowFrom, range.from))
      const boundedTo = clampDocPosition(view, Math.min(windowTo, range.to))
      const startLine = Math.max(1, doc.lineAt(boundedFrom).number - 1)
      const endLine = Math.min(doc.lines, doc.lineAt(boundedTo).number + 1)
      return {
        from: doc.line(startLine).from,
        to: doc.line(endLine).to,
      }
    }),
  )
}

function collectDecorationRanges(
  decorations: DecorationSet,
  from: number,
  to: number,
): Range<Decoration>[] {
  const ranges: Range<Decoration>[] = []
  decorations.between(from, to, (rangeFrom, rangeTo, value) => {
    ranges.push(value.range(rangeFrom, rangeTo))
  })
  return ranges
}

function describeScanLines(view: EditorView, scanRanges: ReadonlyArray<DirtyRegion>) {
  return scanRanges.map((range) => ({
    start: view.state.doc.lineAt(range.from).number,
    end: view.state.doc.lineAt(range.to).number,
  }))
}

function getSelectionRescanRanges(update: ViewUpdate, windowFrom: number, windowTo: number): DirtyRegion[] {
  const mappedPreviousHead = clampDocPosition(update.view, update.changes.mapPos(update.startState.selection.main.head))
  const nextHead = clampDocPosition(update.view, update.state.selection.main.head)

  if (mappedPreviousHead === nextHead) {
    return []
  }

  return mergeDirtyRegions(
    [mappedPreviousHead, nextHead].map((position) => {
      const line = update.view.state.doc.lineAt(position)
      return {
        from: Math.max(windowFrom, line.from),
        to: Math.min(windowTo, line.to),
      }
    }),
  )
}

function buildDecorations(view: EditorView, scanRanges?: ReadonlyArray<DirtyRegion>): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const revealMarkdownAtCursor = view.state.facet(EditorView.editable)
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)
  const activeRanges =
    scanRanges && scanRanges.length > 0 ? mergeDirtyRegions(scanRanges) : [{ from: minFrom, to: maxTo }]
  const codeRanges = activeRanges.flatMap((range) => getCodeRanges(view, range.from, range.to))
  const entries: DecorationEntry[] = []
  let order = 0

  const addDecoration = (from: number, to: number, decoration: Decoration) => {
    entries.push({ from, to, decoration, order: order++ })
  }

  for (const scanRange of activeRanges) {
    syntaxTree(view.state).iterate({
      from: scanRange.from,
      to: scanRange.to,
      enter(node) {
        const { from, to } = node

        // ── Headings ──────────────────────────────────────────────────────────
        const headingClass = headingClasses[node.name]
        if (headingClass) {
          const lineStart = doc.lineAt(from).from
          const lineEnd = doc.lineAt(to).to
          const cursorInside = revealMarkdownAtCursor && cursorHead >= lineStart && cursorHead <= lineEnd

          // Decoration.line() must be added first (startSide = -1 < replace's startSide = 1)
          addDecoration(lineStart, lineStart, Decoration.line({ class: headingClass }))

          if (!cursorInside) {
            const firstChild = node.node.firstChild
            if (firstChild && firstChild.name === 'HeaderMark') {
              // Hide "## " — HeaderMark + the space that follows
              const markEnd = Math.min(firstChild.to + 1, to)
              addDecoration(firstChild.from, markEnd, Decoration.replace({}))
            }
          }
          // Let the iterator visit child nodes (StrongEmphasis etc.) inside the heading
          return
        }

        // ── StrongEmphasis (bold **text**) ────────────────────────────────────
        if (node.name === 'StrongEmphasis') {
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (!cursorInside) {
            // Apply mark only to the content between the ** markers to avoid overlap
            const contentFrom = from + 2
            const contentTo = to - 2
            if (contentFrom < contentTo) {
              addDecoration(from, from + 2, Decoration.replace({}))
              addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-bold' }))
              addDecoration(to - 2, to, Decoration.replace({}))
            }
          }
          return false // skip children — we've handled this node
        }

        // ── Emphasis (italic *text*) ──────────────────────────────────────────
        if (node.name === 'Emphasis') {
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (!cursorInside) {
            const contentFrom = from + 1
            const contentTo = to - 1
            if (contentFrom < contentTo) {
              addDecoration(from, from + 1, Decoration.replace({}))
              addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-italic' }))
              addDecoration(to - 1, to, Decoration.replace({}))
            }
          }
          return false
        }

        // ── Strikethrough (~~text~~) ──────────────────────────────────────────
        if (node.name === 'Strikethrough') {
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (!cursorInside) {
            const contentFrom = from + 2
            const contentTo = to - 2
            if (contentFrom < contentTo) {
              addDecoration(from, from + 2, Decoration.replace({}))
              addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-strikethrough' }))
              addDecoration(to - 2, to, Decoration.replace({}))
            }
          }
          return false
        }

        // ── InlineCode (`code`) ───────────────────────────────────────────────
        if (node.name === 'InlineCode') {
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (!cursorInside) {
            const contentFrom = from + 1
            const contentTo = to - 1
            if (contentFrom < contentTo) {
              addDecoration(from, from + 1, Decoration.replace({}))
              addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-inline-code' }))
              addDecoration(to - 1, to, Decoration.replace({}))
            }
          }
          return false
        }
      },
    })
  }

  for (const scanRange of activeRanges) {
    const startLine = doc.lineAt(scanRange.from).number
    const endLine = doc.lineAt(scanRange.to).number

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
      const line = doc.line(lineNumber)
      for (const segment of getNonCodeSegments(line.from, line.to, codeRanges)) {
        const segmentText = doc.sliceString(segment.from, segment.to)

        // ── Highlight (==text==) ───────────────────────────────────────────
        highlightPattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = highlightPattern.exec(segmentText)) !== null) {
          const from = segment.from + match.index
          const to = from + match[0].length
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (cursorInside) {
            continue
          }

          const contentFrom = from + 2
          const contentTo = to - 2
          if (contentFrom < contentTo) {
            addDecoration(from, from + 2, Decoration.replace({}))
            addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-highlight' }))
            addDecoration(to - 2, to, Decoration.replace({}))
          }
        }

        // ── Superscript (^text^) ──────────────────────────────────────────
        superscriptPattern.lastIndex = 0
        while ((match = superscriptPattern.exec(segmentText)) !== null) {
          const from = segment.from + match.index
          const to = from + match[0].length
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (cursorInside) {
            continue
          }

          const contentFrom = from + 1
          const contentTo = to - 1
          if (contentFrom < contentTo) {
            addDecoration(from, from + 1, Decoration.replace({}))
            addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-superscript' }))
            addDecoration(to - 1, to, Decoration.replace({}))
          }
        }

        // ── Subscript (~text~) ────────────────────────────────────────────
        subscriptPattern.lastIndex = 0
        while ((match = subscriptPattern.exec(segmentText)) !== null) {
          const from = segment.from + match.index
          const to = from + match[0].length
          const cursorInside = isCursorInsideInlineSpan(cursorHead, from, to)
          if (cursorInside) {
            continue
          }

          const contentFrom = from + 1
          const contentTo = to - 1
          if (contentFrom < contentTo) {
            addDecoration(from, from + 1, Decoration.replace({}))
            addDecoration(contentFrom, contentTo, Decoration.mark({ class: 'mf-subscript' }))
            addDecoration(to - 1, to, Decoration.replace({}))
          }
        }
      }
    }
  }

  entries.sort((left, right) => {
    if (left.from !== right.from) {
      return left.from - right.from
    }

    return left.order - right.order
  })

  for (const entry of entries) {
    builder.add(entry.from, entry.to, entry.decoration)
  }

  return builder.finish()
}

export function wysiwygDecorations() {
  return [
    incrementalParsePlugin,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = buildDecorations(view)
        }

        update(update: ViewUpdate) {
          if (!update.docChanged && !update.selectionSet && !update.viewportChanged) {
            return
          }

          const tracker = update.view.plugin(incrementalParsePlugin) as IncrementalParseState | null
          if ((!update.docChanged && (update.viewportChanged || update.selectionSet)) || tracker == null) {
            this.decorations = buildDecorations(update.view)
            tracker?.clear()
            const { from, to } = getDecorationViewportWindow(update.view)
            reportIncrementalParse({
              mode: 'full',
              ranges: [{ from, to }],
              lines: describeScanLines(update.view, [{ from, to }]),
            })
            return
          }

          const { from: windowFrom, to: windowTo } = getDecorationViewportWindow(update.view)
          const scanRanges = mergeDirtyRegions([
            ...expandDirtyRangesToWholeLines(
              update.view,
              windowFrom,
              windowTo,
              tracker.getDirtyRanges(windowFrom, windowTo),
            ),
            ...getSelectionRescanRanges(update, windowFrom, windowTo),
          ])
          const mappedDecorations = this.decorations.map(update.changes)

          if (scanRanges.length === 0) {
            this.decorations = mappedDecorations
            reportIncrementalParse({
              mode: 'mapped',
              ranges: [],
              lines: [],
            })
            return
          }

          const rebuiltDecorations = buildDecorations(update.view, scanRanges)
          let nextDecorations = mappedDecorations

          for (const scanRange of scanRanges) {
            nextDecorations = nextDecorations.update({
              filterFrom: scanRange.from,
              filterTo: scanRange.to,
              filter: (from, to) => to < scanRange.from || from > scanRange.to,
              add: collectDecorationRanges(rebuiltDecorations, scanRange.from, scanRange.to),
              sort: true,
            })
            tracker.cleanRange(scanRange.from, scanRange.to)
          }

          this.decorations = nextDecorations
          reportIncrementalParse({
            mode: 'incremental',
            ranges: scanRanges,
            lines: describeScanLines(update.view, scanRanges),
          })
        }
      },
      { decorations: (value) => value.decorations },
    ),
  ]
}
