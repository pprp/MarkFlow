import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { getDecorationViewportWindow } from './viewportWindow'

const footnoteReferencePattern = /^\[\^([^\]\n]+)\]$/
const footnoteDefinitionPattern = /^(\[\^([^\]\n]+)\]:[ \t]*)(.*)$/

function normalizeFootnoteLabel(label: string) {
  return label.trim().replace(/\s+/g, ' ').toLowerCase()
}

function getBlockCodeRanges(view: EditorView, minFrom: number, maxTo: number) {
  const ranges: Array<{ from: number; to: number }> = []

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
        ranges.push({ from: node.from, to: node.to })
        return false
      }
    },
  })

  return ranges
}

function isInRange(position: number, ranges: ReadonlyArray<{ from: number; to: number }>) {
  return ranges.some((range) => position >= range.from && position <= range.to)
}

function extractFootnoteDefinitions(view: EditorView) {
  const definitions = new Map<string, string>()
  const doc = view.state.doc
  const minFrom = 0
  const maxTo = doc.length
  const blockCodeRanges = getBlockCodeRanges(view, minFrom, maxTo)

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    if (isInRange(line.from, blockCodeRanges)) {
      continue
    }

    const match = line.text.match(footnoteDefinitionPattern)
    if (!match) {
      continue
    }

    const [, , label, firstLineContent] = match
    const previewLines = [firstLineContent]
    let nextLineNumber = lineNumber + 1

    while (nextLineNumber <= doc.lines) {
      const nextLine = doc.line(nextLineNumber)
      if (isInRange(nextLine.from, blockCodeRanges)) {
        break
      }

      if (/^\s*$/.test(nextLine.text)) {
        previewLines.push('')
        nextLineNumber += 1
        continue
      }

      const continuation = nextLine.text.match(/^(?: {4}|\t)(.*)$/)
      if (!continuation) {
        break
      }

      previewLines.push(continuation[1])
      nextLineNumber += 1
    }

    definitions.set(normalizeFootnoteLabel(label), previewLines.join('\n').trim())
    lineNumber = nextLineNumber - 1
  }

  return definitions
}

function isFootnoteDefinitionMarker(view: EditorView, from: number, raw: string) {
  const line = view.state.doc.lineAt(from)
  return line.from === from && line.text.startsWith(`${raw}:`)
}

export function buildFootnoteDecorations(view: EditorView): DecorationSet {
  return buildFootnoteDecorationsWithDefinitions(view, extractFootnoteDefinitions(view))
}

export function buildFootnoteDecorationsWithDefinitions(
  view: EditorView,
  definitions: ReadonlyMap<string, string>,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      if (node.name !== 'Link') {
        return
      }

      const raw = doc.sliceString(node.from, node.to)
      const match = raw.match(footnoteReferencePattern)
      if (!match || isFootnoteDefinitionMarker(view, node.from, raw)) {
        return
      }

      const cursorInside = cursorHead >= node.from && cursorHead <= node.to
      if (cursorInside) {
        return
      }

      const label = match[1]
      const preview = definitions.get(normalizeFootnoteLabel(label))
      const contentFrom = node.from + 2
      const contentTo = node.to - 1

      builder.add(node.from, node.from + 2, Decoration.replace({}))
      builder.add(
        contentFrom,
        contentTo,
        Decoration.mark({
          tagName: 'sup',
          class: preview ? 'mf-footnote-ref' : 'mf-footnote-ref mf-footnote-missing',
          attributes: {
            'data-footnote-label': label,
            title: preview || `Missing footnote: ${label}`,
          },
        }),
      )
      builder.add(node.to - 1, node.to, Decoration.replace({}))
    },
  })

  return builder.finish()
}

export function footnoteDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      definitions: Map<string, string>

      constructor(view: EditorView) {
        this.definitions = extractFootnoteDefinitions(view)
        this.decorations = buildFootnoteDecorationsWithDefinitions(view, this.definitions)
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.definitions = extractFootnoteDefinitions(update.view)
        }
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildFootnoteDecorationsWithDefinitions(update.view, this.definitions)
        }
      }
    },
    { decorations: (value) => value.decorations },
  )
}
