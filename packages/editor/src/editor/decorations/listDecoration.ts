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
import type { SyntaxNode } from '@lezer/common'
import { getDecorationViewportWindow } from './viewportWindow'

const MAX_LIST_MARKER_DEPTH = 6
const LIST_BULLET_GLYPHS = ['•', '◦', '▪', '▸', '–', '·']

function getVisualListDepth(depth: number) {
  return ((Math.max(1, depth) - 1) % MAX_LIST_MARKER_DEPTH) + 1
}

function getListDepthClass(depth: number) {
  return `mf-list-depth-${getVisualListDepth(depth)}`
}

function getMarkerClass(baseClass: string, depth: number) {
  return `mf-list-marker ${baseClass} ${getListDepthClass(depth)}`
}

function getBulletGlyph(depth: number) {
  return LIST_BULLET_GLYPHS[getVisualListDepth(depth) - 1]
}

function getListItemDepth(listItemNode: SyntaxNode) {
  let depth = 1
  let parent = listItemNode.parent

  while (parent) {
    if (parent.name === 'ListItem') {
      depth += 1
    }
    parent = parent.parent
  }

  return depth
}

function addListLineDecoration(
  builder: RangeSetBuilder<Decoration>,
  lineFrom: number,
  depth: number,
) {
  builder.add(
    lineFrom,
    lineFrom,
    Decoration.line({
      class: `mf-list-line ${getListDepthClass(depth)}`,
      attributes: { 'data-list-depth': String(depth) },
    }),
  )
}

function addSourceMarkerDecoration(
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  depth: number,
) {
  if (from >= to) {
    return
  }

  builder.add(
    from,
    to,
    Decoration.mark({ class: `mf-list-source-marker ${getListDepthClass(depth)}` }),
  )
}

class BulletWidget extends WidgetType {
  constructor(private depth: number) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.textContent = getBulletGlyph(this.depth)
    span.className = getMarkerClass('mf-list-bullet', this.depth)
    span.dataset.listDepth = String(this.depth)
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  eq(other: BulletWidget) {
    return this.depth === other.depth
  }
}

class OrderedListWidget extends WidgetType {
  constructor(
    private label: string,
    private depth: number,
  ) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.textContent = this.label
    span.className = getMarkerClass('mf-list-order-marker', this.depth)
    span.dataset.listDepth = String(this.depth)
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  eq(other: OrderedListWidget) {
    return this.label === other.label && this.depth === other.depth
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    private checked: boolean,
    private markerFrom: number,
    private markerTo: number,
    private depth: number,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = `mf-task-checkbox ${getListDepthClass(this.depth)}`
    input.dataset.listDepth = String(this.depth)
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
      this.markerTo === other.markerTo &&
      this.depth === other.depth
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
        const depth = getListItemDepth(node.node)
        addListLineDecoration(builder, line.from, depth)

        // Task list item: - [ ] or - [x]
        const taskMatch = lineText.match(/^(\s*)([-*+]\s)\[( |x)\]\s/)
        if (taskMatch) {
          const markerStart = line.from + taskMatch[1].length
          const prefixEnd = line.from + taskMatch[0].length
          const markerFrom = markerStart + taskMatch[2].length
          const markerTo = markerFrom + 3

          if (!cursorInside) {
            const checked = taskMatch[3] === 'x'
            // Keep leading indentation visible, replacing only the list/task marker.
            builder.add(
              markerStart,
              prefixEnd,
              Decoration.replace({ widget: new CheckboxWidget(checked, markerFrom, markerTo, depth) }),
            )
          } else {
            addSourceMarkerDecoration(builder, markerStart, prefixEnd - 1, depth)
          }
          return
        }

        // Unordered list item: - or * or +
        const bulletMatch = lineText.match(/^(\s*)([-*+])\s/)
        if (bulletMatch) {
          const markerStart = line.from + bulletMatch[1].length
          const markerEnd = markerStart + bulletMatch[2].length

          if (!cursorInside) {
            // Replace "-" / "*" / "+" with a bullet widget
            builder.add(markerStart, markerEnd, Decoration.replace({ widget: new BulletWidget(depth) }))
          } else {
            addSourceMarkerDecoration(builder, markerStart, markerEnd, depth)
          }
          return
        }

        // Ordered list item: render the numeric marker as a widget when the
        // caret is outside the item so the source markup stays hidden.
        const orderedMatch = lineText.match(/^(\s*)(\d+)([.)])\s/)
        if (orderedMatch) {
          const markerStart = line.from + orderedMatch[1].length
          const markerEnd = markerStart + orderedMatch[2].length + orderedMatch[3].length

          if (!cursorInside) {
            const label = `${orderedMatch[2]}${orderedMatch[3]}`
            builder.add(
              markerStart,
              markerEnd,
              Decoration.replace({ widget: new OrderedListWidget(label, depth) }),
            )
          } else {
            addSourceMarkerDecoration(builder, markerStart, markerEnd, depth)
          }
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
