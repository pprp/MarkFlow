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

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.textContent = '•'
    span.className = 'mf-list-bullet'
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  eq() {
    return true
  }
}

class OrderedListWidget extends WidgetType {
  constructor(private label: string) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.textContent = this.label
    span.className = 'mf-list-order-marker'
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  eq(other: OrderedListWidget) {
    return this.label === other.label
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private markerFrom: number,
    private markerTo: number,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'mf-task-checkbox'
    input.setAttribute('aria-label', this.checked ? 'Completed task' : 'Incomplete task')
    input.addEventListener('click', (event) => {
      event.preventDefault()
      view.dispatch({
        changes: {
          from: this.markerFrom,
          to: this.markerTo,
          insert: this.checked ? '[ ]' : '[x]',
        },
      })
      view.focus()
    })
    return input
  }

  eq(other: CheckboxWidget) {
    return (
      this.checked === other.checked &&
      this.markerFrom === other.markerFrom &&
      this.markerTo === other.markerTo
    )
  }

  ignoreEvent() {
    return false
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      if (node.name === 'ListItem') {
        const line = doc.lineAt(from)
        const lineText = line.text

        // Task list item: - [ ] or - [x]
        const taskMatch = lineText.match(/^(\s*[-*+]\s)\[( |x)\]\s/)
        if (taskMatch) {
          if (!cursorInside) {
            const prefixEnd = line.from + taskMatch[0].length
            const checked = taskMatch[2] === 'x'
            const markerFrom = line.from + taskMatch[1].length
            const markerTo = markerFrom + 3
            // Replace the entire "- [x] " prefix with a checkbox widget
            builder.add(
              line.from,
              prefixEnd,
              Decoration.replace({ widget: new CheckboxWidget(checked, markerFrom, markerTo) }),
            )
          }
          return
        }

        // Unordered list item: - or * or +
        const bulletMatch = lineText.match(/^(\s*)([-*+])\s/)
        if (bulletMatch) {
          if (!cursorInside) {
            const markerStart = line.from + bulletMatch[1].length
            const markerEnd = markerStart + bulletMatch[2].length
            // Replace "-" / "*" / "+" with a bullet widget
            builder.add(markerStart, markerEnd, Decoration.replace({ widget: new BulletWidget() }))
          }
          return
        }

        // Ordered list item: render the numeric marker as a widget when the
        // caret is outside the item so the source markup stays hidden.
        const orderedMatch = lineText.match(/^(\s*)(\d+)([.)])\s/)
        if (orderedMatch && !cursorInside) {
          const markerStart = line.from + orderedMatch[1].length
          const markerEnd = markerStart + orderedMatch[2].length + orderedMatch[3].length
          const label = `${orderedMatch[2]}${orderedMatch[3]}`
          builder.add(markerStart, markerEnd, Decoration.replace({ widget: new OrderedListWidget(label) }))
        }
        return
      }
    },
  })

  return builder.finish()
}

export function listDecorations() {
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
