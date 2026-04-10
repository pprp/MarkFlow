import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  buildCodeBlockDecorations,
  codeBlockDecorations,
  LanguageBadgeWidget,
} from '../decorations/codeBlockDecoration'

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

describe('codeBlockDecorations — basic', () => {
  it('mounts without throwing on a fenced code block (cursor outside)', () => {
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

describe('buildCodeBlockDecorations — language badges', () => {
  it('produces a LanguageBadgeWidget for a language-tagged block (cursor outside)', () => {
    // Add trailing text so cursor (doc.length) sits outside the FencedCode range
    const doc = '```typescript\nconst x = 1\n```\n\nafter'
    const view = makeView(doc) // cursor at doc.length (after the block)
    const decoSet = buildCodeBlockDecorations(view)
    let foundBadge = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      const widget = (deco.spec as { widget?: unknown }).widget
      if (widget instanceof LanguageBadgeWidget && widget.lang === 'typescript') {
        foundBadge = true
      }
    })
    expect(foundBadge).toBe(true)
    view.destroy()
  })

  it('produces no LanguageBadgeWidget for a no-language block', () => {
    const doc = '```\nconst x = 1\n```\n\nafter'
    const view = makeView(doc)
    const decoSet = buildCodeBlockDecorations(view)
    let foundBadge = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      if ((deco.spec as { widget?: unknown }).widget instanceof LanguageBadgeWidget) {
        foundBadge = true
      }
    })
    expect(foundBadge).toBe(false)
    view.destroy()
  })

  it('no badge widget when cursor is inside language-tagged block', () => {
    const doc = '```typescript\nconst x = 1\n```'
    const view = makeView(doc, 15) // inside content
    const decoSet = buildCodeBlockDecorations(view)
    let foundBadge = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      if ((deco.spec as { widget?: unknown }).widget instanceof LanguageBadgeWidget) {
        foundBadge = true
      }
    })
    expect(foundBadge).toBe(false)
    view.destroy()
  })

  it('adds mf-code-block-with-lang class to first content line of language-tagged block', () => {
    const doc = '```typescript\nconst x = 1\nconst y = 2\n```\n\nafter'
    const view = makeView(doc)
    const decoSet = buildCodeBlockDecorations(view)
    let hasWithLang = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      const cls = (deco.spec as { class?: string }).class ?? ''
      if (cls.includes('mf-code-block-with-lang')) hasWithLang = true
    })
    expect(hasWithLang).toBe(true)
    view.destroy()
  })

  it('adds data-lang attribute to content lines of language-tagged block', () => {
    const doc = '```python\nprint("hi")\n```\n\nafter'
    const view = makeView(doc)
    const decoSet = buildCodeBlockDecorations(view)
    let foundDataLang = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      const attrs = (deco.spec as { attributes?: Record<string, string> }).attributes
      if (attrs?.['data-lang'] === 'python') foundDataLang = true
    })
    expect(foundDataLang).toBe(true)
    view.destroy()
  })

  it('no data-lang on content lines of no-language block', () => {
    const doc = '```\nhello\n```\n\nafter'
    const view = makeView(doc)
    const decoSet = buildCodeBlockDecorations(view)
    let foundDataLang = false
    decoSet.between(0, doc.length, (_from, _to, deco) => {
      const attrs = (deco.spec as { attributes?: Record<string, string> }).attributes
      if (attrs?.['data-lang']) foundDataLang = true
    })
    expect(foundDataLang).toBe(false)
    view.destroy()
  })

  it('LanguageBadgeWidget.eq returns true for same language', () => {
    const a = new LanguageBadgeWidget('typescript')
    const b = new LanguageBadgeWidget('typescript')
    expect(a.eq(b)).toBe(true)
  })

  it('LanguageBadgeWidget.eq returns false for different language', () => {
    const a = new LanguageBadgeWidget('typescript')
    const b = new LanguageBadgeWidget('python')
    expect(a.eq(b)).toBe(false)
  })

  it('LanguageBadgeWidget.toDOM renders badge with language name', () => {
    const widget = new LanguageBadgeWidget('javascript')
    const el = widget.toDOM()
    expect(el.className).toBe('mf-code-block-header')
    const badge = el.querySelector('.mf-code-lang-badge')
    expect(badge?.textContent).toBe('javascript')
  })

  it('mermaid blocks are excluded from code block decorations', () => {
    const doc = '```mermaid\ngraph LR\n  A-->B\n```\n\nafter'
    const view = makeView(doc)
    const decoSet = buildCodeBlockDecorations(view)
    let count = 0
    decoSet.between(0, doc.length, () => { count++ })
    expect(count).toBe(0)
    view.destroy()
  })
})
