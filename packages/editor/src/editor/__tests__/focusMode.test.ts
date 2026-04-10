import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { focusModeExtension, typewriterModeExtension } from '../extensions/focusMode'

type AnyPlugin = ViewPlugin<{ decorations?: DecorationSet }>

function makeView(doc: string, cursor: number, extensions: ReturnType<typeof focusModeExtension> | ReturnType<typeof typewriterModeExtension>[]) {
  const exts = Array.isArray(extensions) ? extensions : [extensions]
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), ...exts],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function decorationClasses(view: EditorView, plugin: AnyPlugin): string[] {
  const instance = view.plugin(plugin)
  if (!instance?.decorations) return []
  const classes: string[] = []
  instance.decorations.between(0, view.state.doc.length, (_from, _to, deco) => {
    const cls = (deco.spec as { class?: string }).class
    if (cls) classes.push(cls)
  })
  return classes
}

describe('focusModeExtension', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('marks the active line with mf-focus-active', () => {
    const extensions = focusModeExtension()
    // The ViewPlugin is the second element returned
    const plugin = extensions[1] as AnyPlugin
    const doc = 'line one\nline two\nline three'
    // cursor on line one (position 3)
    const view = makeView(doc, 3, extensions)
    const classes = decorationClasses(view, plugin)
    expect(classes.some((c) => c === 'mf-focus-active')).toBe(true)
    view.destroy()
  })

  it('produces exactly one mf-focus-active decoration', () => {
    const extensions = focusModeExtension()
    const plugin = extensions[1] as AnyPlugin
    const doc = 'alpha\nbeta\ngamma'
    const view = makeView(doc, 0, extensions) // cursor on first line
    const classes = decorationClasses(view, plugin)
    expect(classes.filter((c) => c === 'mf-focus-active')).toHaveLength(1)
    view.destroy()
  })

  it('moves mf-focus-active to the new line after cursor moves', () => {
    const extensions = focusModeExtension()
    const plugin = extensions[1] as AnyPlugin
    const doc = 'alpha\nbeta\ngamma'
    const view = makeView(doc, 0, extensions)

    // Move cursor to line 2 (position 6)
    view.dispatch({ selection: { anchor: 6 } })
    const classes = decorationClasses(view, plugin)
    expect(classes.filter((c) => c === 'mf-focus-active')).toHaveLength(1)
    view.destroy()
  })

  it('adds mf-focus-mode class to editor element', () => {
    const extensions = focusModeExtension()
    const doc = 'hello'
    const view = makeView(doc, 0, extensions)
    // editorAttributes apply the class to the .cm-editor element
    expect(view.dom.classList.contains('mf-focus-mode')).toBe(true)
    view.destroy()
  })

  it('preserves document content', () => {
    const doc = '# Heading\n\nParagraph text.'
    const extensions = focusModeExtension()
    const view = makeView(doc, 0, extensions)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })
})

describe('typewriterModeExtension', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts without throwing', () => {
    const ext = typewriterModeExtension()
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [markdown({ base: markdownLanguage }), ext],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves document content', () => {
    const doc = 'Line one\nLine two'
    const ext = typewriterModeExtension()
    const state = EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), ext],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('can receive selection changes without throwing', () => {
    const ext = typewriterModeExtension()
    const state = EditorState.create({
      doc: 'Hello world',
      extensions: [markdown({ base: markdownLanguage }), ext],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    expect(() => {
      view.dispatch({ selection: { anchor: 5 } })
    }).not.toThrow()
    view.destroy()
  })
})
