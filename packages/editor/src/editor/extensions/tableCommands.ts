import { invertedEffects, isolateHistory } from '@codemirror/commands'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorSelection, Prec, StateEffect, Transaction } from '@codemirror/state'
import { EditorView, type KeyBinding, keymap } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

type TableAlignment = 'default' | 'left' | 'center' | 'right'
type TableSection = 'header' | 'body'

interface TableCommandOptions {
  isWysiwygMode?: () => boolean
}

interface TableCursorTarget {
  section: TableSection
  rowIndex: number
  cellIndex: number
}

interface TableModel {
  from: number
  to: number
  indent: string
  header: string[]
  alignments: TableAlignment[]
  bodyRows: string[][]
  currentSection: 'header' | 'body' | 'separator'
  currentRowIndex: number
  currentCellIndex: number
}

const tableCommandSelectionEffect = StateEffect.define<EditorSelection>({
  map: (selection, changes) => selection.map(changes),
})

function isTableCommandEnabled(options?: TableCommandOptions) {
  return options?.isWysiwygMode ? options.isWysiwygMode() : true
}

function hasEnclosingTable(view: EditorView) {
  const { state } = view
  const selection = state.selection.main
  const positions = state.doc.length === 0
    ? [0]
    : Array.from(new Set([selection.head, Math.max(0, selection.head - 1)]))

  for (const position of positions) {
    const tree = ensureSyntaxTree(state, position, 100) ?? syntaxTree(state)
    let node: SyntaxNode | null = tree.resolveInner(position, -1)

    while (node) {
      if (node.name === 'Table') {
        return true
      }

      node = node.parent
    }
  }

  return false
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

function formatAlignment(alignment: TableAlignment, width: number) {
  const safeWidth = Math.max(width, 3)

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

function copyRows(rows: string[][]) {
  return rows.map((row) => [...row])
}

function normalizeRow(row: string[], columnCount: number) {
  const nextRow = [...row]
  while (nextRow.length < columnCount) {
    nextRow.push('')
  }
  return nextRow
}

function findCurrentCellIndex(lineText: string, indentLength: number, lineOffset: number) {
  const text = lineText.slice(indentLength)
  const cellRanges: Array<{ from: number; to: number }> = []
  let escaped = false
  let lastPipe = text.startsWith('|') ? 0 : -1

  for (let index = text.startsWith('|') ? 1 : 0; index < text.length; index++) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char !== '|') {
      continue
    }

    if (lastPipe >= 0) {
      cellRanges.push({ from: lastPipe + 1, to: index })
    }
    lastPipe = index
  }

  if (cellRanges.length === 0) {
    return 0
  }

  const relativeOffset = Math.max(0, lineOffset - indentLength)
  for (let index = 0; index < cellRanges.length; index++) {
    if (relativeOffset <= cellRanges[index].to) {
      return index
    }
  }

  return cellRanges.length - 1
}

function resolveTableModel(view: EditorView): TableModel | null {
  const { state } = view
  const selection = state.selection.main

  if (!selection.empty) {
    return null
  }

  const positions = state.doc.length === 0
    ? [0]
    : Array.from(new Set([selection.head, Math.max(0, selection.head - 1)]))

  for (const position of positions) {
    const tree = ensureSyntaxTree(state, position, 100) ?? syntaxTree(state)
    let node: SyntaxNode | null = tree.resolveInner(position, -1)
    let tableNode: SyntaxNode | null = null
    let rowNode: SyntaxNode | null = null
    let currentSection: TableModel['currentSection'] = 'separator'

    while (node) {
      if (!tableNode && node.name === 'Table') {
        tableNode = node
      }

      if (!rowNode && node.parent?.name === 'Table') {
        if (node.name === 'TableHeader') {
          rowNode = node
          currentSection = 'header'
        } else if (node.name === 'TableRow') {
          rowNode = node
          currentSection = 'body'
        } else if (node.name === 'TableDelimiter') {
          rowNode = node
          currentSection = 'separator'
        }
      }

      node = node.parent
    }

    if (!tableNode) {
      continue
    }

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
      continue
    }

    const headerLine = state.doc.lineAt(headerNode.from).text
    const separatorLine = state.doc.lineAt(separatorNode.from).text
    const indent = headerLine.match(/^\s*/)?.[0] ?? ''
    const header = splitCells(headerLine.slice(indent.length))
    const alignments = splitCells(separatorLine.slice(indent.length)).map(parseAlignment)
    const bodyRows = bodyRowNodes.map((row) => splitCells(state.doc.lineAt(row.from).text.slice(indent.length)))
    const columnCount = Math.max(header.length, alignments.length, ...bodyRows.map((row) => row.length), 1)

    const normalizedHeader = normalizeRow(header, columnCount)
    const normalizedAlignments = normalizeRow(
      alignments as string[],
      columnCount,
    ) as TableAlignment[]
    const normalizedBodyRows = bodyRows.map((row) => normalizeRow(row, columnCount))

    if (currentSection === 'separator') {
      continue
    }

    const currentLine = state.doc.lineAt(selection.head)
    const currentRowIndex = currentSection === 'header'
      ? 0
      : Math.max(0, bodyRowNodes.findIndex((row) => row.from === rowNode?.from))
    const currentCellIndex = findCurrentCellIndex(
      currentLine.text,
      indent.length,
      selection.head - currentLine.from,
    )

    return {
      from: tableNode.from,
      to: tableNode.to,
      indent,
      header: normalizedHeader,
      alignments: normalizedAlignments,
      bodyRows: normalizedBodyRows,
      currentSection,
      currentRowIndex,
      currentCellIndex: Math.min(currentCellIndex, columnCount - 1),
    }
  }

  return null
}

function formatRow(indent: string, cells: string[], widths: number[]) {
  const cellOffsets: number[] = []
  let text = `${indent}|`

  cells.forEach((cell, index) => {
    text += ' '
    cellOffsets.push(text.length - 1)
    text += cell.padEnd(widths[index], ' ')
    text += ' |'
  })

  return { text, cellOffsets }
}

function formatTable(model: TableModel, target: TableCursorTarget) {
  const widths = model.header.map((headerCell, index) => {
    const columnValues = [headerCell, ...model.bodyRows.map((row) => row[index])]
    return Math.max(3, ...columnValues.map((value) => value.length))
  })

  const lines: string[] = []
  let selectionOffset = model.indent.length + 2

  const pushRow = (cells: string[], section: TableSection, rowIndex: number) => {
    const { text, cellOffsets } = formatRow(model.indent, cells, widths)
    if (target.section === section && target.rowIndex === rowIndex) {
      selectionOffset = lines.join('\n').length + (lines.length > 0 ? 1 : 0) + cellOffsets[target.cellIndex]
    }
    lines.push(text)
  }

  pushRow(model.header, 'header', 0)
  lines.push(
    formatRow(
      model.indent,
      model.alignments.map((alignment, index) => formatAlignment(alignment, widths[index])),
      widths,
    ).text,
  )

  model.bodyRows.forEach((row, rowIndex) => {
    pushRow(row, 'body', rowIndex)
  })

  return {
    text: lines.join('\n'),
    selectionOffset,
  }
}

function applyTableEdit(
  view: EditorView,
  model: TableModel,
  target: TableCursorTarget,
) {
  const formatted = formatTable(model, target)
  const selection = EditorSelection.create([
    EditorSelection.cursor(model.from + formatted.selectionOffset, -1),
  ])

  view.dispatch({
    changes: {
      from: model.from,
      to: model.to,
      insert: formatted.text,
    },
    selection,
    effects: tableCommandSelectionEffect.of(selection),
    annotations: [isolateHistory.of('full')],
    scrollIntoView: true,
  })

  return true
}

export function insertTableRowBelow(view: EditorView, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (!model) {
    return false
  }

  const targetCellIndex = model.currentCellIndex
  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  const insertIndex = model.currentSection === 'header' ? 0 : model.currentRowIndex + 1
  nextModel.bodyRows.splice(insertIndex, 0, Array.from({ length: model.header.length }, () => ''))

  return applyTableEdit(view, nextModel, {
    section: 'body',
    rowIndex: insertIndex,
    cellIndex: Math.min(targetCellIndex, model.header.length - 1),
  })
}

export function appendTableRowFromLastCell(view: EditorView, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (
    !model ||
    model.currentSection !== 'body' ||
    model.currentRowIndex !== model.bodyRows.length - 1 ||
    model.currentCellIndex !== model.header.length - 1
  ) {
    return false
  }

  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  const nextRowIndex = nextModel.bodyRows.length
  nextModel.bodyRows.push(Array.from({ length: model.header.length }, () => ''))

  return applyTableEdit(view, nextModel, {
    section: 'body',
    rowIndex: nextRowIndex,
    cellIndex: 0,
  })
}

export function deleteTableRow(view: EditorView, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (!model || model.currentSection !== 'body') {
    return false
  }

  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  nextModel.bodyRows.splice(model.currentRowIndex, 1)

  if (nextModel.bodyRows.length === 0) {
    return applyTableEdit(view, nextModel, {
      section: 'header',
      rowIndex: 0,
      cellIndex: Math.min(model.currentCellIndex, nextModel.header.length - 1),
    })
  }

  return applyTableEdit(view, nextModel, {
    section: 'body',
    rowIndex: Math.min(model.currentRowIndex, nextModel.bodyRows.length - 1),
    cellIndex: Math.min(model.currentCellIndex, nextModel.header.length - 1),
  })
}

function moveTableRow(view: EditorView, direction: -1 | 1, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (!model || model.currentSection !== 'body') {
    return false
  }

  const nextIndex = model.currentRowIndex + direction
  if (nextIndex < 0 || nextIndex >= model.bodyRows.length) {
    return false
  }

  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  const [row] = nextModel.bodyRows.splice(model.currentRowIndex, 1)
  nextModel.bodyRows.splice(nextIndex, 0, row)

  return applyTableEdit(view, nextModel, {
    section: 'body',
    rowIndex: nextIndex,
    cellIndex: Math.min(model.currentCellIndex, nextModel.header.length - 1),
  })
}

export function moveTableRowUp(view: EditorView, options?: TableCommandOptions) {
  return moveTableRow(view, -1, options)
}

export function moveTableRowDown(view: EditorView, options?: TableCommandOptions) {
  return moveTableRow(view, 1, options)
}

function insertTableColumn(view: EditorView, direction: 0 | 1, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (!model || model.currentSection === 'separator') {
    return false
  }

  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  const insertIndex = model.currentCellIndex + direction

  nextModel.header.splice(insertIndex, 0, '')
  nextModel.alignments.splice(insertIndex, 0, 'default')
  nextModel.bodyRows.forEach((row) => row.splice(insertIndex, 0, ''))

  return applyTableEdit(view, nextModel, {
    section: model.currentSection,
    rowIndex: model.currentRowIndex,
    cellIndex: insertIndex,
  })
}

export function insertTableColumnBefore(view: EditorView, options?: TableCommandOptions) {
  return insertTableColumn(view, 0, options)
}

export function insertTableColumnAfter(view: EditorView, options?: TableCommandOptions) {
  return insertTableColumn(view, 1, options)
}

export function deleteTableColumn(view: EditorView, options?: TableCommandOptions) {
  if (!isTableCommandEnabled(options)) {
    return false
  }

  const model = resolveTableModel(view)
  if (!model || model.currentSection === 'separator' || model.header.length <= 1) {
    return false
  }

  const nextModel: TableModel = {
    ...model,
    header: [...model.header],
    alignments: [...model.alignments],
    bodyRows: copyRows(model.bodyRows),
  }
  nextModel.header.splice(model.currentCellIndex, 1)
  nextModel.alignments.splice(model.currentCellIndex, 1)
  nextModel.bodyRows.forEach((row) => row.splice(model.currentCellIndex, 1))

  return applyTableEdit(view, nextModel, {
    section: model.currentSection,
    rowIndex: model.currentRowIndex,
    cellIndex: Math.max(0, Math.min(model.currentCellIndex, nextModel.header.length - 1)),
  })
}

export const tableCommandSurface = {
  insertRowBelow: insertTableRowBelow,
  appendRowFromLastCell: appendTableRowFromLastCell,
  deleteRow: deleteTableRow,
  moveRowUp: moveTableRowUp,
  moveRowDown: moveTableRowDown,
  insertColumnBefore: insertTableColumnBefore,
  insertColumnAfter: insertTableColumnAfter,
  deleteColumn: deleteTableColumn,
}

function buildTableCommandKeymap(options?: TableCommandOptions): KeyBinding[] {
  const runTableCommand = (
    view: EditorView,
    command: (view: EditorView, options?: TableCommandOptions) => boolean,
  ) => {
    if (!isTableCommandEnabled(options)) {
      return false
    }

    return command(view, options) || hasEnclosingTable(view)
  }

  return [
    {
      key: 'Mod-Enter',
      preventDefault: true,
      run: (view) => runTableCommand(view, insertTableRowBelow),
    },
    {
      key: 'Tab',
      preventDefault: true,
      run: (view) => runTableCommand(view, appendTableRowFromLastCell),
    },
    {
      key: 'Mod-Shift-Backspace',
      preventDefault: true,
      run: (view) => runTableCommand(view, deleteTableRow),
    },
    {
      key: 'Alt-ArrowUp',
      preventDefault: true,
      run: (view) => runTableCommand(view, moveTableRowUp),
    },
    {
      key: 'Alt-ArrowDown',
      preventDefault: true,
      run: (view) => runTableCommand(view, moveTableRowDown),
    },
    {
      key: 'Mod-Alt-ArrowLeft',
      preventDefault: true,
      run: (view) => runTableCommand(view, insertTableColumnBefore),
    },
    {
      key: 'Mod-Alt-ArrowRight',
      preventDefault: true,
      run: (view) => runTableCommand(view, insertTableColumnAfter),
    },
    {
      key: 'Mod-Alt-Backspace',
      preventDefault: true,
      run: (view) => runTableCommand(view, deleteTableColumn),
    },
  ]
}

export function tableCommandExtension(options?: TableCommandOptions) {
  return Prec.highest([
    keymap.of(buildTableCommandKeymap(options)),
    invertedEffects.of((tr) => {
      const selectionEffect = tr.effects.find((effect) => effect.is(tableCommandSelectionEffect))
      return selectionEffect ? [tableCommandSelectionEffect.of(selectionEffect.value)] : []
    }),
    EditorView.updateListener.of((update) => {
      for (const transaction of update.transactions) {
        const selectionEffect = transaction.effects.find((effect) => effect.is(tableCommandSelectionEffect))
        if (!selectionEffect || transaction.annotation(Transaction.userEvent) === 'undo') {
          continue
        }

        if (update.state.selection.eq(selectionEffect.value)) {
          continue
        }

        update.view.dispatch({
          selection: selectionEffect.value,
          annotations: Transaction.addToHistory.of(false),
          scrollIntoView: true,
        })
        break
      }
    }),
  ])
}
