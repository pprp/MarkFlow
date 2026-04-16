import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  deleteBlock,
  deleteLineOrSentence,
  deleteRangeExtension,
  deleteStyledScope,
} from '../extensions/deleteRange'

const WYSIWYG_OPTIONS = { isWysiwygMode: () => true }

function makeView(
  doc: string,
  cursor: number,
  options = WYSIWYG_OPTIONS,
) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), deleteRangeExtension(options)],
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

describe('deleteRange', () => {
  it('deletes the current word on Mod-Shift-D without damaging heading markdown', () => {
    const view = makeView('# alpha beta', '# al'.length)

    expect(dispatchEditorShortcut(view, {
      key: 'D',
      code: 'KeyD',
      keyCode: 68,
      ctrlKey: true,
      shiftKey: true,
    })).toBe(true)
    expect(view.state.doc.toString()).toBe('#  beta')

    view.destroy()
  })

  it('deletes the current sentence in a paragraph instead of the raw source line', () => {
    const doc = 'Alpha first sentence. Beta second sentence. Gamma third sentence.'
    const view = makeView(doc, doc.indexOf('Beta') + 2)

    expect(deleteLineOrSentence(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe('Alpha first sentence. Gamma third sentence.')

    view.destroy()
  })

  it('deletes only the current source line inside fenced code blocks', () => {
    const doc = ['```ts', 'const a = 1', 'const b = 2', '```', 'after'].join('\n')
    const view = makeView(doc, doc.indexOf('const b') + 2)

    expect(deleteLineOrSentence(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe(['```ts', 'const a = 1', '```', 'after'].join('\n'))

    view.destroy()
  })

  it('deletes only the current source line inside multiline math blocks', () => {
    const doc = ['before', '', '$$', 'x + 1', 'y + 2', '$$', '', 'after'].join('\n')
    const view = makeView(doc, doc.indexOf('y + 2') + 1)

    expect(deleteLineOrSentence(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe(['before', '', '$$', 'x + 1', '$$', '', 'after'].join('\n'))

    view.destroy()
  })

  it('deletes the active table body row with line-or-sentence semantics', () => {
    const doc = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n')
    const view = makeView(doc, doc.indexOf('| 3 | 4 |') + 2)

    expect(deleteLineOrSentence(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe(['| A   | B   |', '| --- | --- |', '| 1   | 2   |'].join('\n'))

    view.destroy()
  })

  it('deletes the current heading block and collapses the surrounding separator gap', () => {
    const doc = ['Intro', '', '# Title', '', 'Body'].join('\n')
    const view = makeView(doc, doc.indexOf('Title') + 1)

    expect(deleteBlock(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe(['Intro', '', 'Body'].join('\n'))

    view.destroy()
  })

  it('deletes the current list item block without touching its siblings', () => {
    const doc = ['- first', '- second', '- third'].join('\n')
    const view = makeView(doc, doc.indexOf('second') + 1)

    expect(deleteBlock(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe(['- first', '- third'].join('\n'))

    view.destroy()
  })

  it('deletes only the innermost styled scope on Mod-Shift-E', () => {
    const doc = 'before **alpha *beta* gamma** after'
    const view = makeView(doc, doc.indexOf('beta') + 1)

    expect(dispatchEditorShortcut(view, {
      key: 'E',
      code: 'KeyE',
      keyCode: 69,
      ctrlKey: true,
      shiftKey: true,
    })).toBe(true)
    expect(view.state.doc.toString()).toBe('before **alpha  gamma** after')

    view.destroy()
  })

  it('exposes styled-scope deletion as a direct command as well as a shortcut', () => {
    const doc = 'keep [linked text](https://example.com) tail'
    const view = makeView(doc, doc.indexOf('linked') + 2)

    expect(deleteStyledScope(view, WYSIWYG_OPTIONS)).toBe(true)
    expect(view.state.doc.toString()).toBe('keep  tail')

    view.destroy()
  })
})
