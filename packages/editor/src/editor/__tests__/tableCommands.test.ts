import { history, redo, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { describe, expect, it } from 'vitest'
import {
  appendTableRowFromLastCell,
  deleteTableRow,
  insertTableRowBelow,
  moveTableRowUp,
  tableCommandExtension,
} from '../extensions/tableCommands'

const IS_MAC_PLATFORM = /Mac|iPhone|iPad|iPod/.test(globalThis.navigator?.platform ?? '')

const TABLE_DOC = `| Name | Status |
| :--- | ---: |
| Alpha | Open |
| Beta | Done |`

const FORMATTED_TABLE_DOC = `| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
| Beta  | Done   |`

function makeView(
  doc: string,
  cursor: number,
  isWysiwygMode: boolean = true,
) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      history(),
      markdown({ base: markdownLanguage }),
      tableCommandExtension({ isWysiwygMode: () => isWysiwygMode }),
    ],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function dispatchEditorShortcut(
  view: EditorView,
  init: KeyboardEventInit & { key: string; keyCode?: number },
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })

  if (typeof init.keyCode === 'number') {
    Object.defineProperty(event, 'keyCode', { configurable: true, get: () => init.keyCode })
  }

  return runScopeHandlers(view, event, 'editor')
}

function getSelectedLine(view: EditorView) {
  return view.state.doc.lineAt(view.state.selection.main.head).text
}

function getSelectedCell(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const relativeOffset = view.state.selection.main.head - line.from
  const ranges: Array<{ from: number; to: number }> = []
  let escaped = false
  let lastPipe = line.text.startsWith('|') ? 0 : -1

  for (let index = line.text.startsWith('|') ? 1 : 0; index < line.text.length; index++) {
    const char = line.text[index]

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
      ranges.push({ from: lastPipe + 1, to: index })
    }
    lastPipe = index
  }

  const cellIndex = ranges.findIndex((range) => relativeOffset <= range.to)
  const currentCellIndex = cellIndex === -1 ? ranges.length - 1 : cellIndex
  const currentRange = ranges[currentCellIndex]

  return {
    index: currentCellIndex,
    text: line.text.slice(currentRange.from, currentRange.to).trim(),
  }
}

describe('tableCommands', () => {
  it('inserts an empty row below the active table row on Mod-Enter and keeps undo/redo syntax stable', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Alpha') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        ctrlKey: !IS_MAC_PLATFORM,
        metaKey: IS_MAC_PLATFORM,
      }),
    ).toBe(true)

    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
|       |        |
| Beta  | Done   |`)
    expect(getSelectedLine(view)).toBe('|       |        |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: '' })

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)
    expect(getSelectedLine(view)).toBe('| Alpha | Open |')

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
|       |        |
| Beta  | Done   |`)
    expect(getSelectedLine(view)).toBe('|       |        |')

    view.destroy()
  })

  it('appends a new row when Tab is pressed from the last cell of the last body row and restores the appended row on redo', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Done') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
      }),
    ).toBe(true)

    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
| Beta  | Done   |
|       |        |`)
    expect(getSelectedLine(view)).toBe('|       |        |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: '' })

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)
    expect(getSelectedLine(view)).toBe('| Beta | Done |')

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
| Beta  | Done   |
|       |        |`)
    expect(getSelectedLine(view)).toBe('|       |        |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: '' })

    view.destroy()
  })

  it('deletes the active body row on Mod-Shift-Backspace without disturbing the alignment row', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Beta') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'Backspace',
        code: 'Backspace',
        keyCode: 8,
        shiftKey: true,
        ctrlKey: !IS_MAC_PLATFORM,
        metaKey: IS_MAC_PLATFORM,
      }),
    ).toBe(true)

    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |`)
    expect(getSelectedLine(view)).toBe('| Alpha | Open   |')

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |`)
    expect(getSelectedLine(view)).toBe('| Alpha | Open   |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: 'Alpha' })

    view.destroy()
  })

  it('moves the active body row up and down with Alt-Arrow while keeping the header and separator fixed across undo/redo', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Beta') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'ArrowUp',
        code: 'ArrowUp',
        keyCode: 38,
        altKey: true,
      }),
    ).toBe(true)

    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Beta  | Done   |
| Alpha | Open   |`)
    expect(getSelectedLine(view)).toBe('| Beta  | Done   |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: 'Beta' })

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)
    expect(getSelectedLine(view)).toBe('| Beta | Done |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: 'Beta' })

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Beta  | Done   |
| Alpha | Open   |`)
    expect(getSelectedLine(view)).toBe('| Beta  | Done   |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: 'Beta' })

    expect(
      dispatchEditorShortcut(view, {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        altKey: true,
      }),
    ).toBe(true)

    expect(view.state.doc.toString()).toBe(FORMATTED_TABLE_DOC)
    expect(getSelectedLine(view)).toBe('| Beta  | Done   |')
    expect(getSelectedCell(view)).toEqual({ index: 0, text: 'Beta' })

    view.destroy()
  })

  it('exposes column insert and delete hotkeys that preserve rectangular markdown tables', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Open') + 1)

    expect(
      dispatchEditorShortcut(view, {
        key: 'ArrowRight',
        code: 'ArrowRight',
        keyCode: 39,
        altKey: true,
        ctrlKey: !IS_MAC_PLATFORM,
        metaKey: IS_MAC_PLATFORM,
      }),
    ).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |     |
| :---- | -----: | --- |
| Alpha | Open   |     |
| Beta  | Done   |     |`)

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |     |
| :---- | -----: | --- |
| Alpha | Open   |     |
| Beta  | Done   |     |`)
    expect(getSelectedCell(view)).toEqual({ index: 2, text: '' })

    expect(
      dispatchEditorShortcut(view, {
        key: 'Backspace',
        code: 'Backspace',
        keyCode: 8,
        altKey: true,
        ctrlKey: !IS_MAC_PLATFORM,
        metaKey: IS_MAC_PLATFORM,
      }),
    ).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
| Beta  | Done   |`)
    expect(getSelectedCell(view)).toEqual({ index: 1, text: 'Open' })

    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(`| Name  | Status |     |
| :---- | -----: | --- |
| Alpha | Open   |     |
| Beta  | Done   |     |`)
    expect(getSelectedCell(view)).toEqual({ index: 2, text: '' })

    expect(redo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe(FORMATTED_TABLE_DOC)
    expect(getSelectedCell(view)).toEqual({ index: 1, text: 'Open' })

    view.destroy()
  })

  it('supports direct row commands without needing a visible UI surface', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Name') + 2)

    expect(insertTableRowBelow(view, { isWysiwygMode: () => true })).toBe(true)
    expect(deleteTableRow(view, { isWysiwygMode: () => true })).toBe(true)
    expect(moveTableRowUp(view, { isWysiwygMode: () => true })).toBe(false)

    expect(view.state.doc.toString()).toBe(`| Name  | Status |
| :---- | -----: |
| Alpha | Open   |
| Beta  | Done   |`)

    view.destroy()
  })

  it('suppresses generic line-move fallback when Alt-Arrow is pressed from a table header', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Name') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        altKey: true,
      }),
    ).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    view.destroy()
  })

  it('suppresses generic line-move fallback when Alt-Arrow is pressed from the separator row', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('---') + 2)

    expect(
      dispatchEditorShortcut(view, {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        altKey: true,
      }),
    ).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    view.destroy()
  })

  it('does not fall through to generic Tab handling for non-terminal table cells', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Open') + 1)

    expect(
      dispatchEditorShortcut(view, {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
      }),
    ).toBe(true)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    view.destroy()
  })

  it('does not intercept table commands outside WYSIWYG mode', () => {
    const view = makeView(TABLE_DOC, TABLE_DOC.indexOf('Alpha') + 2, false)

    expect(insertTableRowBelow(view, { isWysiwygMode: () => false })).toBe(false)
    expect(appendTableRowFromLastCell(view, { isWysiwygMode: () => false })).toBe(false)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)

    view.destroy()
  })
})
