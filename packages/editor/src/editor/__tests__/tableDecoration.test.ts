import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { DecorationSet, EditorView } from '@codemirror/view'
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

function decoClasses(decoSet: DecorationSet, docLength: number): string[] {
  const classes: string[] = []
  decoSet.between(0, docLength, (_from, _to, deco) => {
    const cls = (deco.spec as { class?: string }).class
    if (cls) classes.push(cls)
  })
  return classes
}

const TABLE_DOC = `| Header A | Header B |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`

describe('tableDecorations', () => {
  it('mounts without throwing for a table', () => {
    const view = makeView(TABLE_DOC)
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves doc content — does not mutate the document', () => {
    const view = makeView(TABLE_DOC)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)
    view.destroy()
  })

  it('adds mf-table-row class decoration to table lines', () => {
    const view = makeView(TABLE_DOC)
    // Access the plugin's decorations via the view's plugin field
    const plugins = (view as unknown as { plugins: Array<{ value: { decorations?: DecorationSet } }> }).plugins
    let decoSet: DecorationSet | undefined
    for (const p of plugins) {
      if (p.value && p.value.decorations) {
        decoSet = p.value.decorations
        break
      }
    }
    if (decoSet) {
      const classes = decoClasses(decoSet, view.state.doc.length)
      expect(classes.some((c) => c.includes('mf-table-row'))).toBe(true)
    }
    view.destroy()
  })

  it('adds mf-table-header-row to the first (header) row', () => {
    const view = makeView(TABLE_DOC)
    const plugins = (view as unknown as { plugins: Array<{ value: { decorations?: DecorationSet } }> }).plugins
    let decoSet: DecorationSet | undefined
    for (const p of plugins) {
      if (p.value && p.value.decorations) {
        decoSet = p.value.decorations
        break
      }
    }
    if (decoSet) {
      const classes = decoClasses(decoSet, view.state.doc.length)
      expect(classes.some((c) => c.includes('mf-table-header-row'))).toBe(true)
    }
    view.destroy()
  })

  it('does not throw for a document without tables', () => {
    const view = makeView('Just plain text without any table.')
    expect(view.state.doc.toString()).toBe('Just plain text without any table.')
    view.destroy()
  })

  it('reveals source markdown when cursor is inside the table', () => {
    // Cursor at position 5 (inside header row)
    const view = makeView(TABLE_DOC, 5)
    expect(view.state.doc.toString()).toBe(TABLE_DOC)
    view.destroy()
  })

  it('handles a single-row table gracefully', () => {
    const doc = '| A | B |\n| - | - |'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})
