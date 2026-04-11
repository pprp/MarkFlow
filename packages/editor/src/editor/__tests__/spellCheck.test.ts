import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { spellCheckExtension, spellCheckExclusionPlugin } from '../extensions/spellCheck'

function createEditor(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      spellCheckExtension()
    ]
  })
  
  const parent = document.createElement('div')
  // We must append it to the document to allow visibleRanges calculation
  document.body.appendChild(parent)
  const view = new EditorView({ state, parent })
  return { view, parent }
}

describe('spellCheckExtension', () => {
  it('excludes inline code from spell checking', () => {
    const { view, parent } = createEditor('This is normal prose and `this is inline code`')
    
    // The language parser might be async or require a force parsing step for small docs
    const pluginInstance = view.plugin(spellCheckExclusionPlugin)
    const decorations = pluginInstance?.decorations
    expect(decorations).toBeDefined()

    const excludedRanges: { from: number; to: number }[] = []
    decorations?.between(0, view.state.doc.length, (from, to) => {
      excludedRanges.push({ from, to })
    })

    // Inline code starts at 25 and ends at 46
    // 'This is normal prose and '.length === 25
    // '`this is inline code`'.length === 21
    expect(excludedRanges.length).toBeGreaterThan(0)
    expect(excludedRanges[0].from).toBe(25)
    expect(excludedRanges[0].to).toBe(46)
    
    view.destroy()
    document.body.removeChild(parent)
  })

  it('excludes fenced code blocks from spell checking', () => {
    const doc = "Here is some prose.\n\n```javascript\nconst foo = \"bar\"\n```\n\nMore prose."

    const { view, parent } = createEditor(doc)
    const pluginInstance = view.plugin(spellCheckExclusionPlugin)
    
    const excludedRanges: { from: number; to: number }[] = []
    pluginInstance?.decorations.between(0, view.state.doc.length, (from, to) => {
      excludedRanges.push({ from, to })
    })

    expect(excludedRanges.length).toBeGreaterThan(0)
    
    const codeStart = doc.indexOf('```')
    const codeEnd = doc.lastIndexOf('```') + 3
    
    const match = excludedRanges.find(r => r.from === codeStart && r.to === codeEnd)
    expect(match).toBeDefined()

    view.destroy()
    document.body.removeChild(parent)
  })

  it('excludes links and URLs from spell checking', () => {
    const { view, parent } = createEditor('Check [this link](https://example.com) and plain https://url.com')
    const pluginInstance = view.plugin(spellCheckExclusionPlugin)
    
    const excludedRanges: { from: number; to: number }[] = []
    pluginInstance?.decorations.between(0, view.state.doc.length, (from, to) => {
      excludedRanges.push({ from, to })
    })

    // Should find the link range and the URL range
    expect(excludedRanges.length).toBe(2)
    
    view.destroy()
    document.body.removeChild(parent)
  })

  it('excludes YAML front matter from spell checking', () => {
    const doc = "---\ntitle: My Post\ndate: 2026-04-11\n---\nThis is regular content."

    const { view, parent } = createEditor(doc)
    const pluginInstance = view.plugin(spellCheckExclusionPlugin)
    
    const excludedRanges: { from: number; to: number }[] = []
    pluginInstance?.decorations.between(0, view.state.doc.length, (from, to) => {
      excludedRanges.push({ from, to })
    })

    const fmStart = 0
    const fmEnd = doc.indexOf('This is') - 1
    
    const match = excludedRanges.find(r => r.from === fmStart && r.to === fmEnd)
    expect(match).toBeDefined()

    view.destroy()
    document.body.removeChild(parent)
  })
})