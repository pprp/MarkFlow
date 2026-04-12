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

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'mf-hr-widget'
    return hr
  }
  eq() {
    return true
  }
  get estimatedHeight() {
    return 24
  }
}

type CalloutType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

const CALLOUT_ICONS: Record<CalloutType, string> = {
  NOTE: 'ℹ',
  TIP: '💡',
  IMPORTANT: '❗',
  WARNING: '⚠',
  CAUTION: '🔥',
}

const CALLOUT_PATTERN = /^\s*(?:>\s?)+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i

class CalloutLabelWidget extends WidgetType {
  private readonly type: CalloutType
  private readonly rawText: string

  constructor(type: CalloutType, rawText: string) {
    super()
    this.type = type
    this.rawText = rawText
  }

  eq(other: CalloutLabelWidget) {
    return other.type === this.type && other.rawText === this.rawText
  }

  toDOM() {
    const span = document.createElement('span')
    const lower = this.type.toLowerCase()
    span.className = `mf-callout-label mf-callout-${lower}`
    span.textContent = `${CALLOUT_ICONS[this.type]} ${this.type}`
    return span
  }

  get estimatedHeight() {
    return -1
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)
  const decoratedLines = new Set<number>()

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (node.name === 'Blockquote') {
        const firstLine = doc.lineAt(from)
        const lastLine = doc.lineAt(to)

        for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
          if (decoratedLines.has(lineNum)) {
            continue
          }

          decoratedLines.add(lineNum)
          const line = doc.line(lineNum)
          builder.add(line.from, line.from, Decoration.line({ class: 'mf-blockquote' }))

          // Check for callout/admonition syntax: > [!TYPE]
          const calloutMatch = line.text.match(CALLOUT_PATTERN)
          if (calloutMatch) {
            const calloutType = calloutMatch[1].toUpperCase() as CalloutType
            const lower = calloutType.toLowerCase()
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: `mf-callout mf-callout-${lower}` }),
            )

            if (!cursorInside) {
              // Replace the entire "> [!TYPE]" prefix with the styled widget
              const prefixLength = calloutMatch[0].length
              builder.add(
                line.from,
                line.from + prefixLength,
                Decoration.replace({
                  widget: new CalloutLabelWidget(calloutType, calloutMatch[0]),
                }),
              )
            }
          } else if (!cursorInside) {
            const match = line.text.match(/^(\s*(?:>\s?)+)/)
            if (match) {
              builder.add(line.from, line.from + match[1].length, Decoration.replace({}))
            }
          }
        }
        return
      }

      if (node.name === 'HorizontalRule') {
        if (!cursorInside) {
          builder.add(from, to, Decoration.replace({ widget: new HrWidget() }))
        }
      }
    },
  })

  return builder.finish()
}

export function blockquoteDecorations() {
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
