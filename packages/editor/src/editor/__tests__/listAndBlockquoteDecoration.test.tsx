import { fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { listDecorations } from '../decorations/listDecoration'
import { blockquoteDecorations } from '../decorations/blockquoteDecoration'

type DecorationPlugin = ViewPlugin<{ decorations: DecorationSet }>

type DecorationEntry = {
  from: number
  to: number
  spec: {
    class?: string
    widget?: {
      constructor: { name: string }
      toDOM: (view: EditorView) => HTMLElement
    }
  }
}

function makeView(doc: string, cursor: number, plugins: DecorationPlugin[]) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), ...plugins],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function decorationEntries(view: EditorView, plugin: DecorationPlugin) {
  const instance = view.plugin(plugin)
  expect(instance).not.toBeNull()

  const entries: DecorationEntry[] = []

  instance!.decorations.between(0, view.state.doc.length, (from, to, value) => {
    entries.push({ from, to, spec: value.spec as DecorationEntry['spec'] })
  })

  return entries
}

function widgetText(entry: DecorationEntry, view: EditorView) {
  return entry.spec.widget?.toDOM(view).textContent ?? null
}

function widgetClassName(entry: DecorationEntry, view: EditorView) {
  return entry.spec.widget?.toDOM(view).className ?? ''
}

describe('listDecorations', () => {
  it('renders unordered list markers as widgets when the caret is outside the item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- alpha\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'BulletWidget')).toBe(true)
    expect(entries.some((entry) => widgetText(entry, view) === '•')).toBe(true)

    view.destroy()
  })

  it('keeps unordered list markers editable when the caret is inside the item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- alpha\n\nplain text'
    const view = makeView(doc, 3, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'BulletWidget')).toBe(false)

    view.destroy()
  })

  it('renders ordered list markers as widgets when the caret is outside the item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '1. alpha\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'OrderedListWidget')).toBe(true)
    expect(entries.some((entry) => widgetText(entry, view) === '1.')).toBe(true)

    view.destroy()
  })

  it('keeps ordered list markers editable when the caret is inside the item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '1. alpha\n\nplain text'
    const view = makeView(doc, 4, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'OrderedListWidget')).toBe(false)

    view.destroy()
  })

  it('renders task list checkboxes as widgets when the caret is outside the item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- [x] done\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'CheckboxWidget')).toBe(true)

    view.destroy()
  })

  it('toggles task list markdown when a rendered checkbox is clicked', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- [ ] todo\n- [x] done\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])

    const checkboxes = Array.from(view.dom.querySelectorAll<HTMLInputElement>('input.mf-task-checkbox'))
    expect(checkboxes).toHaveLength(2)

    fireEvent.click(checkboxes[0])
    expect(view.state.doc.toString()).toBe('- [x] todo\n- [x] done\n\nplain text')

    const updatedCheckboxes = Array.from(view.dom.querySelectorAll<HTMLInputElement>('input.mf-task-checkbox'))
    fireEvent.click(updatedCheckboxes[1])
    expect(view.state.doc.toString()).toBe('- [x] todo\n- [ ] done\n\nplain text')

    view.destroy()
  })

  it('renders nested list markers contextually when the caret is outside the list tree', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- parent\n  - child\n    1. grandchild\n    - [ ] task\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.filter((entry) => entry.spec.widget?.constructor.name === 'BulletWidget')).toHaveLength(2)
    expect(entries.filter((entry) => entry.spec.widget?.constructor.name === 'OrderedListWidget')).toHaveLength(1)
    expect(entries.filter((entry) => entry.spec.widget?.constructor.name === 'CheckboxWidget')).toHaveLength(1)

    view.destroy()
  })

  it('gives nested rendered list markers distinct visual levels', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- parent\n  - child\n    - grandchild\n      1. ordered\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)
    const bulletEntries = entries.filter((entry) => entry.spec.widget?.constructor.name === 'BulletWidget')
    const orderedEntry = entries.find((entry) => entry.spec.widget?.constructor.name === 'OrderedListWidget')

    expect(bulletEntries.map((entry) => widgetText(entry, view))).toEqual(['•', '◦', '▪'])
    expect(widgetClassName(bulletEntries[0], view)).toContain('mf-list-depth-1')
    expect(widgetClassName(bulletEntries[1], view)).toContain('mf-list-depth-2')
    expect(widgetClassName(bulletEntries[2], view)).toContain('mf-list-depth-3')
    expect(orderedEntry).toBeDefined()
    expect(widgetClassName(orderedEntry!, view)).toContain('mf-list-depth-4')

    view.destroy()
  })

  it('preserves indentation when nested task list markers become checkboxes', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- parent\n  - [ ] child task\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)
    const checkboxEntry = entries.find((entry) => entry.spec.widget?.constructor.name === 'CheckboxWidget')
    const childLine = view.state.doc.line(2)

    expect(checkboxEntry).toBeDefined()
    expect(checkboxEntry?.from).toBe(childLine.from + 2)
    expect(widgetClassName(checkboxEntry!, view)).toContain('mf-list-depth-2')

    view.destroy()
  })

  it('keeps nested list markdown editable when the caret is inside a nested item', () => {
    const plugin = listDecorations() as DecorationPlugin
    const doc = '- parent\n  - child\n    - [ ] task\n\nplain text'
    const view = makeView(doc, doc.indexOf('task'), [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.some((entry) => entry.spec.widget)).toBe(false)

    view.destroy()
  })
})

describe('blockquoteDecorations', () => {
  it('hides quote markers when the caret is outside the blockquote', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = '> quoted line\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(view.state.doc.toString()).toBe(doc)
    expect(entries.some((entry) => entry.spec.class === 'mf-blockquote')).toBe(true)
    expect(entries.some((entry) => entry.from === 0 && entry.to === 2 && !entry.spec.widget)).toBe(true)

    view.destroy()
  })

  it('keeps quote markers visible when the caret is inside the blockquote', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = '> quoted line\n\nplain text'
    const view = makeView(doc, 4, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.some((entry) => entry.spec.class === 'mf-blockquote')).toBe(true)
    expect(entries.some((entry) => entry.from === 0 && entry.to === 2 && !entry.spec.widget)).toBe(false)

    view.destroy()
  })

  it('hides nested quote markers when the caret is outside the blockquote tree', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = '> outer\n> > inner\n\nplain text'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)
    const secondLineStart = view.state.doc.line(2).from

    expect(entries.filter((entry) => entry.spec.class === 'mf-blockquote')).toHaveLength(2)
    expect(entries.some((entry) => entry.from === 0 && entry.to === 2 && !entry.spec.widget)).toBe(true)
    expect(entries.some((entry) => entry.from === secondLineStart && entry.to === secondLineStart + 4 && !entry.spec.widget)).toBe(true)

    view.destroy()
  })

  it('keeps nested quote markers visible when the caret is inside the nested blockquote', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = '> outer\n> > inner\n\nplain text'
    const view = makeView(doc, doc.indexOf('inner'), [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.filter((entry) => entry.spec.class === 'mf-blockquote')).toHaveLength(2)
    expect(entries.some((entry) => entry.to > entry.from && !entry.spec.widget)).toBe(false)

    view.destroy()
  })

  it('renders dash horizontal rules as separators when the caret is outside the rule line', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = 'before\n\n---\n\nafter'
    const view = makeView(doc, doc.length, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'HrWidget')).toBe(true)

    view.destroy()
  })

  it('keeps star horizontal rules editable when the caret is on the rule line', () => {
    const plugin = blockquoteDecorations() as DecorationPlugin
    const doc = 'before\n\n***\n\nafter'
    const view = makeView(doc, doc.indexOf('***') + 1, [plugin])
    const entries = decorationEntries(view, plugin)

    expect(entries.some((entry) => entry.spec.widget?.constructor.name === 'HrWidget')).toBe(false)

    view.destroy()
  })
})
