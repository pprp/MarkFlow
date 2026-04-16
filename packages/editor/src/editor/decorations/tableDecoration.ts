import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { getDecorationViewportWindow } from './viewportWindow'

const MIN_TABLE_COLUMN_WIDTH_HINT = 3
const MIN_TABLE_COLUMN_WIDTH_PX = 56

type TableAlignment = 'default' | 'left' | 'center' | 'right'

interface DecorationEntry {
  from: number
  to: number
  decoration: Decoration
  order: number
}

interface TableLayout {
  tableFrom: number
  tableTo: number
  separatorFrom: number
  separatorTo: number
  indent: string
  alignments: TableAlignment[]
  widthHints: number[]
  columnCount: number
}

interface TableResizeSource extends TableLayout {
  columnIndex: number
}

interface TableResizeSession {
  pointerId: number
  startX: number
  didMove: boolean
  widths: number[]
}

function splitCells(line: string): string[] {
  const trimmed = line.trim()
  const parts: string[] = []
  let current = ''
  let escaped = false

  for (const char of trimmed) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (char === '|') {
      parts.push(current)
      current = ''
      continue
    }

    current += char
  }

  parts.push(current)

  if (trimmed.startsWith('|')) {
    parts.shift()
  }

  if (trimmed.endsWith('|')) {
    parts.pop()
  }

  return parts.map((part) => part.trim())
}

function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim()
  const startsWithColon = trimmed.startsWith(':')
  const endsWithColon = trimmed.endsWith(':')

  if (startsWithColon && endsWithColon) {
    return 'center'
  }

  if (startsWithColon) {
    return 'left'
  }

  if (endsWithColon) {
    return 'right'
  }

  return 'default'
}

function parseWidthHint(cell: string) {
  return Math.max(MIN_TABLE_COLUMN_WIDTH_HINT, cell.trim().length)
}

function formatAlignment(alignment: TableAlignment, width: number) {
  const safeWidth = Math.max(width, MIN_TABLE_COLUMN_WIDTH_HINT)

  switch (alignment) {
    case 'left':
      return `:${'-'.repeat(Math.max(safeWidth - 1, 2))}`
    case 'right':
      return `${'-'.repeat(Math.max(safeWidth - 1, 2))}:`
    case 'center':
      return safeWidth <= 3 ? ':-:' : `:${'-'.repeat(safeWidth - 2)}:`
    default:
      return '-'.repeat(safeWidth)
  }
}

function formatSeparatorLine(indent: string, alignments: TableAlignment[], widthHints: number[]) {
  const cells = widthHints.map((widthHint, index) => formatAlignment(alignments[index] ?? 'default', widthHint))
  return `${indent}| ${cells.join(' | ')} |`
}

function normalizeWidthHints(widthHints: number[], columnCount: number) {
  const nextHints = [...widthHints]
  while (nextHints.length < columnCount) {
    nextHints.push(MIN_TABLE_COLUMN_WIDTH_HINT)
  }
  return nextHints.slice(0, columnCount).map((widthHint) => Math.max(MIN_TABLE_COLUMN_WIDTH_HINT, widthHint))
}

function normalizeAlignments(alignments: TableAlignment[], columnCount: number) {
  const nextAlignments = [...alignments]
  while (nextAlignments.length < columnCount) {
    nextAlignments.push('default')
  }
  return nextAlignments.slice(0, columnCount)
}

function toPercentWidth(widthHint: number, widthHints: number[]) {
  const total = widthHints.reduce((sum, value) => sum + value, 0)
  const safeTotal = total > 0 ? total : widthHints.length || 1
  return `${((widthHint / safeTotal) * 100).toFixed(3)}%`
}

function buildCellStyle(widthHints: number[], columnIndex: number, alignment: TableAlignment) {
  const width = toPercentWidth(widthHints[columnIndex] ?? MIN_TABLE_COLUMN_WIDTH_HINT, widthHints)
  const textAlign = alignment === 'default' ? 'left' : alignment
  return [
    'display: block',
    `flex: 0 0 ${width}`,
    `width: ${width}`,
    `max-width: ${width}`,
    `text-align: ${textAlign}`,
  ].join('; ')
}

function buildCellAttributes(tableFrom: number, columnIndex: number, widthHints: number[], alignment: TableAlignment) {
  return {
    'data-mf-table-from': String(tableFrom),
    'data-mf-table-column': String(columnIndex),
    style: buildCellStyle(widthHints, columnIndex, alignment),
  }
}

function compareNumericDataset(left: Element, right: Element, name: string) {
  const leftValue = Number.parseInt((left as HTMLElement).dataset[name] ?? '', 10)
  const rightValue = Number.parseInt((right as HTMLElement).dataset[name] ?? '', 10)
  return leftValue - rightValue
}

function queryTableRows(view: EditorView, tableFrom: number) {
  return Array.from(
    view.dom.querySelectorAll(`.cm-line[data-mf-table-from="${tableFrom}"]:not(.mf-table-separator-row)`),
  ) as HTMLElement[]
}

function queryTableCells(row: HTMLElement) {
  return Array.from(row.querySelectorAll('.mf-table-cell[data-mf-table-column]'))
    .sort((left, right) => compareNumericDataset(left, right, 'mfTableColumn')) as HTMLElement[]
}

function applyWidthCss(cell: HTMLElement, widthCss: string) {
  cell.style.flex = `0 0 ${widthCss}`
  cell.style.width = widthCss
  cell.style.maxWidth = widthCss
}

function applyHintWidthsToDom(view: EditorView, tableFrom: number, widthHints: number[]) {
  const widths = widthHints.map((widthHint) => toPercentWidth(widthHint, widthHints))
  for (const row of queryTableRows(view, tableFrom)) {
    queryTableCells(row).forEach((cell, index) => {
      applyWidthCss(cell, widths[index] ?? widths[widths.length - 1] ?? '100%')
    })
  }
  view.requestMeasure()
}

function applyPixelWidthsToDom(view: EditorView, tableFrom: number, widths: number[]) {
  for (const row of queryTableRows(view, tableFrom)) {
    queryTableCells(row).forEach((cell, index) => {
      const width = widths[index]
      if (typeof width === 'number') {
        applyWidthCss(cell, `${Math.round(width)}px`)
      }
    })
  }
  view.requestMeasure()
}

function readRenderedWidths(view: EditorView, tableFrom: number, columnCount: number) {
  const headerRow = queryTableRows(view, tableFrom).find((row) => row.classList.contains('mf-table-header-row'))
  if (!headerRow) {
    return null
  }

  const headerCells = queryTableCells(headerRow)
  if (headerCells.length < columnCount) {
    return null
  }

  const widths = headerCells
    .slice(0, columnCount)
    .map((cell) => Math.round(cell.getBoundingClientRect().width))

  return widths.every((width) => width > 0) ? widths : null
}

function deriveWidthHintsFromPixels(widths: number[], sourceHints: number[]) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  const totalHints = Math.max(
    sourceHints.reduce((sum, widthHint) => sum + widthHint, 0),
    sourceHints.length * MIN_TABLE_COLUMN_WIDTH_HINT,
  )
  const scale = totalWidth > 0 ? totalHints / totalWidth : 1

  return widths.map((width, index) => {
    const fallback = sourceHints[index] ?? MIN_TABLE_COLUMN_WIDTH_HINT
    return Math.max(MIN_TABLE_COLUMN_WIDTH_HINT, Math.round(width * scale) || fallback)
  })
}

function resolveTableLayout(doc: EditorView['state']['doc'], tableNode: SyntaxNode): TableLayout | null {
  let headerNode: SyntaxNode | null = null
  let separatorNode: SyntaxNode | null = null
  const bodyRowNodes: SyntaxNode[] = []

  let child = tableNode.firstChild
  while (child) {
    if (child.name === 'TableHeader') {
      headerNode = child
    } else if (child.name === 'TableDelimiter' && child.parent?.name === 'Table') {
      separatorNode = child
    } else if (child.name === 'TableRow') {
      bodyRowNodes.push(child)
    }
    child = child.nextSibling
  }

  if (!headerNode || !separatorNode) {
    return null
  }

  const headerLine = doc.lineAt(headerNode.from).text
  const separatorLine = doc.lineAt(separatorNode.from)
  const indent = headerLine.match(/^\s*/)?.[0] ?? ''
  const header = splitCells(headerLine.slice(indent.length))
  const separatorCells = splitCells(separatorLine.text.slice(indent.length))
  const bodyRows = bodyRowNodes.map((row) => splitCells(doc.lineAt(row.from).text.slice(indent.length)))
  const columnCount = Math.max(header.length, separatorCells.length, ...bodyRows.map((row) => row.length), 1)

  return {
    tableFrom: tableNode.from,
    tableTo: tableNode.to,
    separatorFrom: separatorLine.from,
    separatorTo: separatorLine.to,
    indent,
    alignments: normalizeAlignments(separatorCells.map(parseAlignment), columnCount),
    widthHints: normalizeWidthHints(separatorCells.map(parseWidthHint), columnCount),
    columnCount,
  }
}

class EmptyTableCellWidget extends WidgetType {
  constructor(private attributes: Record<string, string>) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'mf-table-cell mf-table-cell--empty'
    for (const [name, value] of Object.entries(this.attributes)) {
      span.setAttribute(name, value)
    }
    span.textContent = '\u00a0'
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  eq(other: EmptyTableCellWidget) {
    return JSON.stringify(this.attributes) === JSON.stringify(other.attributes)
  }
}

class TableResizeHandleWidget extends WidgetType {
  constructor(private source: TableResizeSource) {
    super()
  }

  toDOM(view: EditorView) {
    const boundary = document.createElement('span')
    boundary.className = 'mf-table-resize-boundary'
    boundary.dataset.tableFrom = String(this.source.tableFrom)
    boundary.dataset.columnIndex = String(this.source.columnIndex)

    const handle = document.createElement('span')
    handle.className = 'mf-table-resize-handle'
    handle.dataset.columnBoundary = String(this.source.columnIndex)
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-hidden', 'true')
    handle.setAttribute('aria-orientation', 'vertical')

    let activeResize: TableResizeSession | null = null

    const resetPreview = () => {
      applyHintWidthsToDom(view, this.source.tableFrom, this.source.widthHints)
      delete boundary.dataset.resizing
      activeResize = null
    }

    const commitResize = () => {
      if (!activeResize) {
        return
      }

      const { didMove, widths } = activeResize
      delete boundary.dataset.resizing
      activeResize = null

      if (!didMove) {
        resetPreview()
        return
      }

      const nextWidthHints = deriveWidthHintsFromPixels(widths, this.source.widthHints)
      const nextSeparator = formatSeparatorLine(this.source.indent, this.source.alignments, nextWidthHints)
      const currentSeparator = view.state.doc.sliceString(this.source.separatorFrom, this.source.separatorTo)

      if (currentSeparator !== nextSeparator) {
        view.dispatch({
          changes: {
            from: this.source.separatorFrom,
            to: this.source.separatorTo,
            insert: nextSeparator,
          },
        })
      } else {
        applyHintWidthsToDom(view, this.source.tableFrom, this.source.widthHints)
      }
    }

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return
      }

      const widths = readRenderedWidths(view, this.source.tableFrom, this.source.columnCount)
      if (!widths) {
        return
      }

      activeResize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        didMove: false,
        widths,
      }

      boundary.dataset.resizing = 'true'
      handle.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      event.stopPropagation()
    })

    handle.addEventListener('pointermove', (event) => {
      if (!activeResize || event.pointerId !== activeResize.pointerId) {
        return
      }

      const nextWidths = [...activeResize.widths]
      const leftIndex = this.source.columnIndex
      const rightIndex = leftIndex + 1
      const startLeft = nextWidths[leftIndex]
      const startRight = nextWidths[rightIndex]
      const combinedWidth = startLeft + startRight
      const delta = event.clientX - activeResize.startX
      const nextLeft = Math.max(
        MIN_TABLE_COLUMN_WIDTH_PX,
        Math.min(combinedWidth - MIN_TABLE_COLUMN_WIDTH_PX, startLeft + delta),
      )
      const nextRight = Math.max(MIN_TABLE_COLUMN_WIDTH_PX, combinedWidth - nextLeft)

      nextWidths[leftIndex] = nextLeft
      nextWidths[rightIndex] = nextRight
      activeResize = {
        ...activeResize,
        didMove: true,
        widths: nextWidths,
      }

      applyPixelWidthsToDom(view, this.source.tableFrom, nextWidths)
      event.preventDefault()
      event.stopPropagation()
    })

    handle.addEventListener('pointerup', (event) => {
      if (!activeResize || event.pointerId !== activeResize.pointerId) {
        return
      }

      handle.releasePointerCapture?.(event.pointerId)
      commitResize()
      event.preventDefault()
      event.stopPropagation()
    })

    handle.addEventListener('pointercancel', (event) => {
      if (!activeResize || event.pointerId !== activeResize.pointerId) {
        return
      }

      handle.releasePointerCapture?.(event.pointerId)
      resetPreview()
      event.preventDefault()
      event.stopPropagation()
    })

    boundary.append(handle)
    return boundary
  }

  eq(other: TableResizeHandleWidget) {
    return (
      this.source.tableFrom === other.source.tableFrom &&
      this.source.separatorFrom === other.source.separatorFrom &&
      this.source.separatorTo === other.source.separatorTo &&
      this.source.columnIndex === other.source.columnIndex &&
      this.source.indent === other.source.indent &&
      this.source.columnCount === other.source.columnCount &&
      this.source.alignments.join('|') === other.source.alignments.join('|') &&
      this.source.widthHints.join('|') === other.source.widthHints.join('|')
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
  const entries: DecorationEntry[] = []
  let order = 0

  const addDecoration = (from: number, to: number, decoration: Decoration) => {
    entries.push({ from, to, decoration, order: order++ })
  }

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      const { from, to } = node

      if (node.name === 'Table') {
        const cursorInside = cursorHead >= from && cursorHead <= to
        const tableNode = node.node
        const layout = resolveTableLayout(doc, tableNode)

        if (!layout) {
          return false
        }

        const firstChild = tableNode.firstChild
        const headerRowTo = firstChild && firstChild.name === 'TableHeader' ? firstChild.to : -1
        const firstLine = doc.lineAt(from)
        const lastLine = doc.lineAt(to)

        if (!cursorInside) {
          for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
            const line = doc.line(lineNum)
            const isHeader = headerRowTo !== -1 && line.from <= headerRowTo
            const isDelimiterRow = line.from === layout.separatorFrom
            const lineClass = isDelimiterRow
              ? 'mf-table-row mf-table-separator-row'
              : isHeader
                ? 'mf-table-row mf-table-header-row'
                : 'mf-table-row'
            addDecoration(
              line.from,
              line.from,
              Decoration.line({
                class: lineClass,
                attributes: {
                  'data-mf-table-from': String(layout.tableFrom),
                  'data-mf-table-to': String(layout.tableTo),
                },
              }),
            )

            if (isDelimiterRow) {
              addDecoration(
                line.from,
                line.to,
                Decoration.replace({}),
              )
              continue
            }

            const text = line.text
            const indentLength = text.match(/^\s*/)?.[0].length ?? 0
            let pos = indentLength
            let columnIndex = 0

            if (text[pos] === '|') {
              addDecoration(line.from + pos, line.from + pos + 1, Decoration.replace({}))
              pos++
            }

            while (pos < text.length) {
              const nextPipe = text.indexOf('|', pos)
              const cellFrom = line.from + pos
              const cellTo = nextPipe === -1 ? line.to : line.from + nextPipe
              const alignment = layout.alignments[columnIndex] ?? 'default'
              const attributes = buildCellAttributes(
                layout.tableFrom,
                columnIndex,
                layout.widthHints,
                alignment,
              )

              if (cellFrom < cellTo) {
                addDecoration(
                  cellFrom,
                  cellTo,
                  Decoration.mark({ class: 'mf-table-cell', attributes }),
                )
              } else {
                addDecoration(
                  cellFrom,
                  cellTo,
                  Decoration.widget({
                    widget: new EmptyTableCellWidget(attributes),
                    side: 1,
                  }),
                )
              }

              columnIndex++

              if (nextPipe === -1) {
                break
              }

              addDecoration(
                line.from + nextPipe,
                line.from + nextPipe + 1,
                Decoration.replace({}),
              )

              if (isHeader && columnIndex < layout.columnCount) {
                addDecoration(
                  line.from + nextPipe + 1,
                  line.from + nextPipe + 1,
                  Decoration.widget({
                    widget: new TableResizeHandleWidget({
                      ...layout,
                      columnIndex: columnIndex - 1,
                    }),
                    side: -1,
                  }),
                )
              }

              pos = nextPipe + 1
            }

            while (columnIndex < layout.columnCount) {
              const alignment = layout.alignments[columnIndex] ?? 'default'
              addDecoration(
                line.to,
                line.to,
                Decoration.widget({
                  widget: new EmptyTableCellWidget(
                    buildCellAttributes(layout.tableFrom, columnIndex, layout.widthHints, alignment),
                  ),
                  side: 1,
                }),
              )
              columnIndex++
            }
          }
        } else {
          for (let lineNum = firstLine.number; lineNum <= lastLine.number; lineNum++) {
            const line = doc.line(lineNum)
            const isHeader = headerRowTo !== -1 && line.from <= headerRowTo
            const lineClass = isHeader ? 'mf-table-row mf-table-header-row' : 'mf-table-row'
            addDecoration(
              line.from,
              line.from,
              Decoration.line({
                class: lineClass,
                attributes: {
                  'data-mf-table-from': String(layout.tableFrom),
                  'data-mf-table-to': String(layout.tableTo),
                },
              }),
            )
          }
        }

        return false
      }
    },
  })

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

export function tableDecorations() {
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
