import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { tableDecorations } from '../decorations/tableDecoration'

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), tableDecorations()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

function lineText(view: EditorView, index: number) {
  const line = view.dom.querySelectorAll('.cm-line').item(index)
  return line?.textContent ?? ''
}

function getRow(view: EditorView, className: string) {
  return view.dom.querySelector(`.cm-line.${className}`) as HTMLElement | null
}

function getHeaderCells(view: EditorView) {
  return Array.from(view.dom.querySelectorAll('.mf-table-header-row .mf-table-cell')) as HTMLElement[]
}

function getTableCellRule() {
  const globalCss = readFileSync('src/styles/global.css', 'utf8')
  const ruleMatch = globalCss.match(/\.cm-editor\s+\.mf-table-cell\s*\{(?<body>[^}]+)\}/)
  expect(ruleMatch?.groups?.body).toBeTruthy()
  return ruleMatch?.groups?.body ?? ''
}

function ensurePointerEventSupport() {
  if (window.PointerEvent) {
    return
  }

  class MockPointerEvent extends MouseEvent {
    pointerId: number

    constructor(type: string, params: PointerEventInit & { pointerId?: number } = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
    }
  }

  vi.stubGlobal('PointerEvent', MockPointerEvent)
}

function mockRect(element: Element, params: { left: number; top: number; width: number; height: number }) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: params.width,
      height: params.height,
      top: params.top,
      left: params.left,
      bottom: params.top + params.height,
      right: params.left + params.width,
      x: params.left,
      y: params.top,
      toJSON: () => {},
    }),
  })
}

const TABLE_ONLY = `| Header A | Header B |
| :-------- | ---: |
| Cell 1    | Cell 2 |
| Cell 3    | Cell 4 |`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tableDecorations', () => {
  it('mounts without throwing for a table', () => {
    const view = makeView(TABLE_ONLY)
    expect(view).toBeTruthy()
    destroyView(view)
  })

  it('preserves doc content and renders resize handles plus alignment-aware widths in WYSIWYG mode', () => {
    const doc = `Intro\n\n${TABLE_ONLY}\n\nAfter`
    const view = makeView(doc, 0)

    expect(view.state.doc.toString()).toBe(doc)
    expect(view.dom.querySelectorAll('.mf-table-resize-handle')).toHaveLength(1)

    const headerRow = getRow(view, 'mf-table-header-row')
    const bodyRow = view.dom.querySelector(
      '.cm-line.mf-table-row:not(.mf-table-header-row):not(.mf-table-separator-row)',
    ) as HTMLElement
    const headerCells = getHeaderCells(view)
    const bodyCells = Array.from(bodyRow.querySelectorAll('.mf-table-cell')) as HTMLElement[]

    expect(headerRow).not.toBeNull()
    expect(view.dom.querySelector('.mf-table-separator-row')).not.toBeNull()
    expect(headerCells).toHaveLength(2)
    expect(bodyCells).toHaveLength(2)
    expect(parseFloat(headerCells[0].style.width)).toBeGreaterThan(parseFloat(headerCells[1].style.width))
    expect(headerCells[0].style.textAlign).toBe('left')
    expect(headerCells[1].style.textAlign).toBe('right')
    expect(bodyCells[1].style.textAlign).toBe('right')

    destroyView(view)
  })

  it('allows rendered long table cell content to wrap instead of truncating it', () => {
    const tableCellRule = getTableCellRule()

    expect(tableCellRule).not.toMatch(/white-space\s*:\s*nowrap\b/)
    expect(tableCellRule).not.toMatch(/overflow\s*:\s*hidden\b/)
    expect(tableCellRule).not.toMatch(/text-overflow\s*:\s*ellipsis\b/)
    expect(tableCellRule).toMatch(/white-space\s*:\s*normal\b/)
    expect(tableCellRule).toMatch(/overflow-wrap\s*:\s*anywhere\b/)
    expect(tableCellRule).toMatch(/overflow\s*:\s*visible\b/)
  })

  it('keeps long table content visible and editable across rendered/source table transitions', () => {
    const longCell =
      'This rendered markdown table cell contains a deliberately long sentence that must remain readable instead of disappearing behind an ellipsis.'
    const doc = `Intro\n\n| Notes | Owner |\n| --- | --- |\n| ${longCell} | Ada |\n\nAfter`
    const view = makeView(doc, 0)
    const renderedCellSelector = '.cm-line.mf-table-row:not(.mf-table-header-row):not(.mf-table-separator-row) .mf-table-cell'

    expect((view.dom.querySelector(renderedCellSelector) as HTMLElement | null)?.textContent).toContain(longCell)

    view.dispatch({ selection: { anchor: doc.indexOf(longCell) + 8 } })
    expect(view.state.doc.toString()).toBe(doc)
    expect(lineText(view, 4)).toContain(longCell)

    view.dispatch({ selection: { anchor: 0 } })
    expect(view.state.doc.toString()).toBe(doc)
    expect((view.dom.querySelector(renderedCellSelector) as HTMLElement | null)?.textContent).toContain(longCell)

    destroyView(view)
  })

  it('reveals raw markdown and hides resize handles when the caret enters the table source', () => {
    const doc = `Intro\n\n${TABLE_ONLY}\n\nAfter`
    const cursor = doc.indexOf('Header A') + 2
    const view = makeView(doc, cursor)

    expect(view.dom.querySelector('.mf-table-resize-handle')).toBeNull()
    expect(lineText(view, 3)).toContain('| :-------- | ---: |')

    destroyView(view)
  })

  it('persists resized column intent by rewriting only the separator row and rehydrates it on reopen', () => {
    ensurePointerEventSupport()

    const table = `| Project | Owner |
| :-------- | ---: |
| MarkFlow | Ada |
| Notes | Lin |`
    const doc = `Intro\n\n${table}\n\nAfter`
    const view = makeView(doc, 0)
    const handle = view.dom.querySelector('.mf-table-resize-handle') as HTMLElement
    const headerCells = getHeaderCells(view)

    expect(handle).not.toBeNull()
    expect(headerCells).toHaveLength(2)

    mockRect(headerCells[0], { left: 40, top: 20, width: 240, height: 32 })
    mockRect(headerCells[1], { left: 280, top: 20, width: 160, height: 32 })

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: 280, clientY: 36 }))
    handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 340, clientY: 36 }))

    expect(headerCells[0].style.width).toBe('300px')
    expect(headerCells[1].style.width).toBe('100px')

    handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 340, clientY: 36 }))

    const expectedTable = `| Project | Owner |
| :--------- | --: |
| MarkFlow | Ada |
| Notes | Lin |`
    const expectedDoc = `Intro\n\n${expectedTable}\n\nAfter`
    expect(view.state.doc.toString()).toBe(expectedDoc)
    expect(view.state.doc.line(3).text).toBe('| Project | Owner |')
    expect(view.state.doc.line(5).text).toBe('| MarkFlow | Ada |')
    expect(view.state.doc.line(6).text).toBe('| Notes | Lin |')

    const reopenedView = makeView(expectedDoc, 0)
    const reopenedHeaderCells = getHeaderCells(reopenedView)
    expect(reopenedHeaderCells).toHaveLength(2)
    expect(parseFloat(reopenedHeaderCells[0].style.width)).toBeGreaterThan(parseFloat(reopenedHeaderCells[1].style.width))
    expect(reopenedHeaderCells[1].style.textAlign).toBe('right')

    destroyView(reopenedView)
    destroyView(view)
  })

  it('handles a single-row table gracefully', () => {
    const doc = '| A | B |\n| - | - |'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    destroyView(view)
  })
})
