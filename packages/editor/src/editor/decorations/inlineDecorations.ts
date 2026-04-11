import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

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
const superscriptPattern = /\^([^\^\n]+)\^/g
const subscriptPattern = /~([^~\n]+)~/g

function getCodeRanges(view: EditorView): Array<{ from: number; to: number }> {
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

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const codeRanges = getCodeRanges(view)
  const entries: DecorationEntry[] = []
  let order = 0

  const addDecoration = (from: number, to: number, decoration: Decoration) => {
    entries.push({ from, to, decoration, order: order++ })
  }

  syntaxTree(view.state).iterate({
    enter(node) {
      const { from, to } = node

      // ── Headings ──────────────────────────────────────────────────────────
      const headingClass = headingClasses[node.name]
      if (headingClass) {
        const lineStart = doc.lineAt(from).from
        const lineEnd = doc.lineAt(to).to
        const cursorInside = cursorHead >= lineStart && cursorHead <= lineEnd

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
        const cursorInside = cursorHead >= from && cursorHead <= to
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
        const cursorInside = cursorHead >= from && cursorHead <= to
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
        const cursorInside = cursorHead >= from && cursorHead <= to
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
        const cursorInside = cursorHead >= from && cursorHead <= to
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

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
    const line = doc.line(lineNumber)
    for (const segment of getNonCodeSegments(line.from, line.to, codeRanges)) {
      const segmentText = doc.sliceString(segment.from, segment.to)

      // ── Highlight (==text==) ───────────────────────────────────────────
      highlightPattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = highlightPattern.exec(segmentText)) !== null) {
        const from = segment.from + match.index
        const to = from + match[0].length
        const cursorInside = cursorHead >= from && cursorHead <= to
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
        const cursorInside = cursorHead >= from && cursorHead <= to
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
        const cursorInside = cursorHead >= from && cursorHead <= to
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
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
