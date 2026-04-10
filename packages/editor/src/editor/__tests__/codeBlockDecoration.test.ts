import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { codeBlockDecorations } from '../decorations/codeBlockDecoration'

function makeView(doc: string, cursor?: number) {
  const anchor = cursor ?? doc.length
  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(anchor, doc.length) },
    extensions: [markdown({ base: markdownLanguage }), codeBlockDecorations()],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

const fencedDoc = '```typescript\nconst x = 1\n```'

describe('codeBlockDecorations', () => {
  it('mounts without throwing on a fenced code block (cursor outside)', () => {
    // cursor after the block — cursor at doc.length puts it outside
    const after = fencedDoc + '\n\nSome text after'
    const view = makeView(after)
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves doc content', () => {
    const view = makeView(fencedDoc)
    expect(view.state.doc.toString()).toBe(fencedDoc)
    view.destroy()
  })

  it('cursor inside code block — content line is preserved', () => {
    const view = makeView(fencedDoc, 15) // inside "const x = 1"
    expect(view.state.doc.line(2).text).toBe('const x = 1')
    view.destroy()
  })

  it('handles empty code block without crashing', () => {
    const view = makeView('```\n```')
    expect(view).toBeTruthy()
    view.destroy()
  })
})
