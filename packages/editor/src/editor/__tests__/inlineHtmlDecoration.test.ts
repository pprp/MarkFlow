import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { inlineHtmlDecorations } from '../decorations/inlineHtmlDecoration'

function makeView(doc: string, cursor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage }),
      inlineHtmlDecorations(),
      EditorView.lineWrapping,
    ],
  })

  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function lineText(view: EditorView, index: number) {
  return view.dom.querySelectorAll('.cm-line').item(index)?.textContent ?? ''
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

describe('inlineHtmlDecorations', () => {
  it('hides block HTML comments away from the caret and reveals them when editing', () => {
    const doc = ['Before', '', '<!-- hidden note -->', '', 'After'].join('\n')
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(view.dom.querySelectorAll('.mf-html-block')).toHaveLength(1)
    expect(lineText(view, 2)).not.toContain('<!-- hidden note -->')

    view.dispatch({ selection: { anchor: doc.indexOf('hidden') } })

    expect(view.dom.querySelector('.mf-html-block')).toBeNull()
    expect(lineText(view, 2)).toContain('<!-- hidden note -->')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(view.dom.querySelectorAll('.mf-html-block')).toHaveLength(1)
    expect(lineText(view, 2)).not.toContain('<!-- hidden note -->')

    destroyView(view)
  })

  it('hides inline HTML comments away from the caret and restores their source when focused', () => {
    const doc = 'Hello <!-- note --> world'
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(1)
    expect(lineText(view, 0)).not.toContain('<!-- note -->')

    view.dispatch({ selection: { anchor: doc.indexOf('note') } })

    expect(view.dom.querySelector('.mf-html-inline')).toBeNull()
    expect(lineText(view, 0)).toContain('<!-- note -->')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(1)
    expect(lineText(view, 0)).not.toContain('<!-- note -->')

    destroyView(view)
  })

  it('renders HTML entities as decoded characters away from the caret and preserves raw source on focus', () => {
    const doc = 'Symbols: &copy; &reg; &nbsp;'
    const view = makeView(doc)

    expect(view.state.doc.toString()).toBe(doc)
    expect(Array.from(view.dom.querySelectorAll('.mf-html-inline')).map((element) => element.textContent)).toEqual([
      '©',
      '®',
      '\u00a0',
    ])
    expect(lineText(view, 0)).toContain('©')
    expect(lineText(view, 0)).toContain('®')
    expect(lineText(view, 0)).not.toContain('&copy;')
    expect(lineText(view, 0)).not.toContain('&reg;')
    expect(lineText(view, 0)).not.toContain('&nbsp;')

    view.dispatch({ selection: { anchor: doc.indexOf('&copy;') + 1 } })

    expect(view.dom.querySelectorAll('.mf-html-inline')).toHaveLength(2)
    expect(lineText(view, 0)).toContain('&copy;')
    expect(lineText(view, 0)).not.toContain('&reg;')
    expect(lineText(view, 0)).not.toContain('&nbsp;')

    view.dispatch({ selection: { anchor: doc.length } })

    expect(Array.from(view.dom.querySelectorAll('.mf-html-inline')).map((element) => element.textContent)).toEqual([
      '©',
      '®',
      '\u00a0',
    ])

    destroyView(view)
  })

  it('renders video and audio tags with safe media attributes away from the caret and restores raw source on focus', () => {
    const doc = [
      '<video controls src="https://example.com/sample.mp4" width="640" height="360" onplay="alert(1)"></video>',
      '<audio controls src="file:///tmp/sample.mp3" preload="metadata" onplay="alert(1)"></audio>',
    ].join('\n')
    const view = makeView(doc)

    const video = view.dom.querySelector('video')
    const audio = view.dom.querySelector('audio')

    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe('https://example.com/sample.mp4')
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(video?.getAttribute('width')).toBe('640')
    expect(video?.getAttribute('height')).toBe('360')
    expect(video?.hasAttribute('onplay')).toBe(false)

    expect(audio).not.toBeNull()
    expect(audio?.getAttribute('src')).toBe('file:///tmp/sample.mp3')
    expect(audio?.hasAttribute('controls')).toBe(true)
    expect(audio?.getAttribute('preload')).toBe('metadata')
    expect(audio?.hasAttribute('onplay')).toBe(false)

    expect(lineText(view, 0)).not.toContain('<video')
    expect(lineText(view, 1)).not.toContain('<audio')

    view.dispatch({ selection: { anchor: doc.indexOf('controls src="https://example.com/sample.mp4"') } })

    expect(view.dom.querySelector('video')).toBeNull()
    expect(lineText(view, 0)).toContain('<video controls src="https://example.com/sample.mp4"')
    expect(view.dom.querySelector('audio')).not.toBeNull()

    destroyView(view)
  })

  it('renders iframe embeds in a sandboxed container and keeps script and event-handler filtering', () => {
    const doc = [
      'Before',
      '',
      '<iframe src="https://example.com/embed" width="560" height="315" allow="fullscreen; camera; autoplay" allowfullscreen onload="alert(1)"></iframe>',
      '',
      '<script>alert(1)</script>',
      '',
      'After',
    ].join('\n')
    const view = makeView(doc)

    const iframe = view.dom.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toBe('https://example.com/embed')
    expect(iframe?.getAttribute('width')).toBe('560')
    expect(iframe?.getAttribute('height')).toBe('315')
    expect(iframe?.getAttribute('allow')).toBe('fullscreen; autoplay')
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true)
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-presentation')
    expect(iframe?.hasAttribute('onload')).toBe(false)
    expect(view.dom.querySelector('script')).toBeNull()
    expect(view.dom.textContent).not.toContain('alert(1)')

    destroyView(view)
  })

  it('strips unsafe iframe source URLs while keeping the embed sandboxed', () => {
    const doc = ['Before', '', '<iframe src="javascript:alert(1)" allowfullscreen></iframe>', '', 'After'].join('\n')
    const view = makeView(doc)

    const iframe = view.dom.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.hasAttribute('src')).toBe(false)
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true)
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-presentation')

    destroyView(view)
  })
})
