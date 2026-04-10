import { describe, it, expect, beforeEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  detectFrontMatter,
  buildFrontMatterDecorations,
  yamlFrontMatterDecorations,
} from '../decorations/yamlFrontMatter'

function makeView(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ base: markdownLanguage }), yamlFrontMatterDecorations()],
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

describe('detectFrontMatter', () => {
  it('detects front matter with --- delimiters', () => {
    const doc = EditorState.create({ doc: '---\ntitle: Hello\n---\nBody' }).doc
    const result = detectFrontMatter(doc)
    expect(result).not.toBeNull()
    expect(result?.firstLine).toBe(1)
    expect(result?.lastLine).toBe(3)
  })

  it('detects front matter closed with ...', () => {
    const doc = EditorState.create({ doc: '---\nkey: value\n...\nBody' }).doc
    const result = detectFrontMatter(doc)
    expect(result).not.toBeNull()
    expect(result?.lastLine).toBe(3)
  })

  it('returns null for documents without front matter', () => {
    const doc = EditorState.create({ doc: '# Heading\nBody text' }).doc
    expect(detectFrontMatter(doc)).toBeNull()
  })

  it('returns null when --- is not at line 1', () => {
    const doc = EditorState.create({ doc: 'Intro\n---\nNot front matter\n---' }).doc
    expect(detectFrontMatter(doc)).toBeNull()
  })

  it('returns null when there is no closing fence', () => {
    const doc = EditorState.create({ doc: '---\ntitle: Hello\nNo closing fence' }).doc
    expect(detectFrontMatter(doc)).toBeNull()
  })

  it('returns null for empty document', () => {
    const doc = EditorState.create({ doc: '' }).doc
    expect(detectFrontMatter(doc)).toBeNull()
  })

  it('returns null for single-line document', () => {
    const doc = EditorState.create({ doc: '---' }).doc
    expect(detectFrontMatter(doc)).toBeNull()
  })
})

describe('buildFrontMatterDecorations', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('decorates fence lines with mf-yaml-fence', () => {
    const view = makeView('---\ntitle: Test\n---\nBody text')
    const decoSet = buildFrontMatterDecorations(view)
    const classes = decoClasses(decoSet, view.state.doc.length)
    expect(classes.filter((c) => c === 'mf-yaml-fence')).toHaveLength(2)
    view.destroy()
  })

  it('decorates content lines with mf-yaml-frontmatter', () => {
    const view = makeView('---\ntitle: Test\nauthor: pprp\n---\nBody')
    const decoSet = buildFrontMatterDecorations(view)
    const classes = decoClasses(decoSet, view.state.doc.length)
    expect(classes.filter((c) => c === 'mf-yaml-frontmatter')).toHaveLength(2)
    view.destroy()
  })

  it('produces no decorations when there is no front matter', () => {
    const view = makeView('# Heading\nBody text')
    const decoSet = buildFrontMatterDecorations(view)
    const classes = decoClasses(decoSet, view.state.doc.length)
    expect(classes).toHaveLength(0)
    view.destroy()
  })
})

describe('yamlFrontMatterDecorations — ViewPlugin', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('mounts without throwing', () => {
    const view = makeView('---\ntitle: Hello\n---\nBody')
    expect(view).toBeTruthy()
    view.destroy()
  })

  it('preserves document content', () => {
    const doc = '---\ntitle: Hello\ndate: 2026-04-10\n---\n# Heading\nBody text.'
    const view = makeView(doc)
    expect(view.state.doc.toString()).toBe(doc)
    view.destroy()
  })

  it('plugin instance has decorations when front matter is present', () => {
    const plugin = yamlFrontMatterDecorations() as ViewPlugin<{ decorations: DecorationSet }>
    const state = EditorState.create({
      doc: '---\ntitle: Test\n---\nBody',
      extensions: [markdown({ base: markdownLanguage }), plugin],
    })
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = new EditorView({ state, parent })
    const instance = view.plugin(plugin)
    expect(instance).not.toBeNull()
    const classes = decoClasses(instance!.decorations, view.state.doc.length)
    expect(classes.length).toBeGreaterThan(0)
    view.destroy()
  })
})
