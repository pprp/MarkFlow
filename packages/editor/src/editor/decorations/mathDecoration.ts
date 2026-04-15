import katex from 'katex'
import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'

// ── Widgets ───────────────────────────────────────────────────────────────────

class InlineMathWidget extends WidgetType {
  constructor(readonly source: string) {
    super()
  }

  eq(other: InlineMathWidget) {
    return other.source === this.source
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'mf-math-inline'
    try {
      span.innerHTML = katex.renderToString(this.source, {
        throwOnError: false,
        displayMode: false,
      })
    } catch {
      span.textContent = `$${this.source}$`
    }
    return span
  }

  ignoreEvent() {
    return false
  }
}

class BlockMathWidget extends WidgetType {
  constructor(readonly source: string) {
    super()
  }

  eq(other: BlockMathWidget) {
    return other.source === this.source
  }

  toDOM() {
    const div = document.createElement('div')
    div.className = 'mf-math-block'
    try {
      div.innerHTML = katex.renderToString(this.source.trim(), {
        throwOnError: false,
        displayMode: true,
      })
    } catch {
      div.textContent = `$$${this.source}$$`
    }
    return div
  }

  ignoreEvent() {
    return false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Collect ranges of fenced code / inline code to avoid math-inside-code. */
function getCodeRanges(view: EditorView, from: number, to: number): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []
  syntaxTree(view.state).iterate({
    from,
    to,
    enter(node) {
      if (
        node.name === 'FencedCode' ||
        node.name === 'CodeBlock' ||
        node.name === 'InlineCode'
      ) {
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
  return ranges.some((r) => from < r.to && to > r.from)
}

// ── Decoration builder ────────────────────────────────────────────────────────

interface DecoEntry {
  from: number
  to: number
  deco: Decoration
}

const multiLineBlockDelimiters = [
  { open: '$$', close: '$$' },
  { open: '\\[', close: '\\]' },
] as const

const singleLineBlockMathPatterns = [
  /\$\$([^$\n]+?)\$\$/g,
  /(?<!\\)\\\[([^\n]+?)\\\]/g,
]

const inlineMathPatterns = [
  /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
  /(?<!\\)\\\(([^$\n]+?)\\\)/g,
]

export function buildMathDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const { from: minFrom, to: maxTo, startLine, endLine } = getDecorationViewportWindow(view)
  const cursor = view.state.selection.main.head
  const codeRanges = getCodeRanges(view, minFrom, maxTo)

  const entries: DecoEntry[] = []
  // Ranges spanned by multi-line $$...$$ blocks (so inline scan can skip them).
  const blockMathRanges: Array<{ from: number; to: number }> = []

  // ── Multi-line block math: $$\n…\n$$ ─────────────────────────────────────
  // A line whose trimmed content is exactly "$$" acts as open/close delimiter.
  let openBlock: { lineNum: number; lineFrom: number; closeDelimiter: string } | null = null
  const contentBuf: string[] = []

  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i)
    const trimmed = line.text.trim()

    if (!openBlock) {
      const delimiter = multiLineBlockDelimiters.find(({ open }) => trimmed === open)
      if (delimiter && !overlapsAny(line.from, line.to, codeRanges)) {
        openBlock = { lineNum: i, lineFrom: line.from, closeDelimiter: delimiter.close }
        contentBuf.length = 0
      }
      continue
    }

    if (trimmed === openBlock.closeDelimiter) {
      // Closing delimiter
      const closeLine = line
      const source = contentBuf.join('\n')
      const blockFrom = openBlock.lineFrom
      const blockTo = closeLine.to

      blockMathRanges.push({ from: blockFrom, to: blockTo })

      if (!(cursor >= blockFrom && cursor <= blockTo)) {
        const openLineRef = doc.line(openBlock.lineNum)
        // Replace the opening "$$" line with the block widget.
        entries.push({
          from: openLineRef.from,
          to: openLineRef.to,
          deco: Decoration.replace({ widget: new BlockMathWidget(source) }),
        })
        // Hide each content line (text only — newlines stay to preserve layout).
        for (let j = openBlock.lineNum + 1; j < i; j++) {
          const cl = doc.line(j)
          entries.push({ from: cl.from, to: cl.to, deco: Decoration.replace({}) })
        }
        // Hide the closing "$$" line.
        entries.push({ from: closeLine.from, to: closeLine.to, deco: Decoration.replace({}) })
      }

      openBlock = null
      contentBuf.length = 0
      continue
    }

    contentBuf.push(line.text)
  }

  // ── Single-line display math: $$expr$$ within a line ─────────────────────
  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i)
    // Skip lines inside already-processed multi-line blocks or code.
    if (overlapsAny(line.from, line.to, blockMathRanges)) continue
    if (overlapsAny(line.from, line.to, codeRanges)) continue

    for (const displayRe of singleLineBlockMathPatterns) {
      displayRe.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = displayRe.exec(line.text)) !== null) {
        const from = line.from + m.index
        const to = from + m[0].length
        const source = m[1]
        if (!source.trim()) continue
        if (cursor >= from && cursor <= to) continue
        entries.push({ from, to, deco: Decoration.replace({ widget: new BlockMathWidget(source) }) })
        // Record so inline scan won't also touch this range.
        blockMathRanges.push({ from, to })
      }
    }
  }

  // ── Inline math: $expr$ per line ─────────────────────────────────────────
  // Opening/closing $ must not be adjacent to another $.
  for (let i = startLine; i <= endLine; i++) {
    const line = doc.line(i)
    if (overlapsAny(line.from, line.to, blockMathRanges)) continue
    if (overlapsAny(line.from, line.to, codeRanges)) continue

    for (const inlineRe of inlineMathPatterns) {
      inlineRe.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = inlineRe.exec(line.text)) !== null) {
        const from = line.from + m.index
        const to = from + m[0].length
        const source = m[1]
        if (!source.trim()) continue
        if (cursor >= from && cursor <= to) continue
        entries.push({ from, to, deco: Decoration.replace({ widget: new InlineMathWidget(source) }) })
      }
    }
  }

  // RangeSetBuilder requires entries in document order, no overlaps.
  entries.sort((a, b) => a.from - b.from)
  for (const { from, to, deco } of entries) {
    builder.add(from, to, deco)
  }

  return builder.finish()
}

// ── Extension ─────────────────────────────────────────────────────────────────

export function mathDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildMathDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildMathDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
