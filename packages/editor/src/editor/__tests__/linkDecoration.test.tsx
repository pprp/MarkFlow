import { fireEvent, render } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'
import { linkDecorations, resolveImageSource } from '../decorations/linkDecoration'

function makeView(doc: string, cursor: number, filePath?: string) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), linkDecorations(filePath)],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function lineText(view: EditorView, index: number) {
  const line = view.dom.querySelectorAll('.cm-line').item(index)
  return line?.textContent ?? ''
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

describe('link decorations', () => {
  it('renders unfocused markdown links as clickable anchors', () => {
    const { container } = render(
      <MarkFlowEditor content="Start [OpenAI](https://openai.com)" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const link = container.querySelector('a.mf-link')
    expect(link).not.toBeNull()
    expect(link).toHaveTextContent('OpenAI')
    expect(link).toHaveAttribute('href', 'https://openai.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('opens rendered links in a new window only on Cmd/Ctrl+Click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { container } = render(
      <MarkFlowEditor content="Start [OpenAI](https://openai.com)" viewMode="wysiwyg" onChange={vi.fn()} />,
    )

    const link = container.querySelector('a.mf-link')
    expect(link).not.toBeNull()

    fireEvent.click(link as Element)
    expect(openSpy).not.toHaveBeenCalled()

    fireEvent.click(link as Element, { ctrlKey: true })
    expect(openSpy).toHaveBeenCalledWith('https://openai.com', '_blank', 'noopener,noreferrer')

    openSpy.mockRestore()
  })

  it('renders remote, relative, and absolute markdown images as inline preview widgets', () => {
    const doc = [
      'Intro',
      '',
      '![Remote](https://example.com/remote.png)',
      '![Relative](./fixtures/diagram.png)',
      '![Absolute](/tmp/markflow-image.png)',
    ].join('\n')
    const view = makeView(doc, 0, '/Users/pprp/docs/note.md')

    const images = Array.from(view.dom.querySelectorAll('img.mf-image-widget'))
    expect(images).toHaveLength(3)
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      'https://example.com/remote.png',
      'file:///Users/pprp/docs/fixtures/diagram.png',
      'file:///tmp/markflow-image.png',
    ])
    expect(images.map((image) => image.getAttribute('alt'))).toEqual(['Remote', 'Relative', 'Absolute'])
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('keeps raw image markdown editable when the caret moves into an image token', () => {
    const doc = ['Intro', '', '![Diagram](./fixtures/diagram.png)', 'After'].join('\n')
    const view = makeView(doc, 0)

    expect(view.dom.querySelector('img.mf-image-widget')).not.toBeNull()

    view.dispatch({ selection: { anchor: doc.indexOf('Diagram') } })

    expect(view.dom.querySelector('img.mf-image-widget')).toBeNull()
    expect(lineText(view, 2)).toContain('![Diagram](./fixtures/diagram.png)')
    expect(view.state.doc.toString()).toBe(doc)

    view.dispatch({ selection: { anchor: 0 } })

    expect(view.dom.querySelector('img.mf-image-widget')).not.toBeNull()

    destroyView(view)
  })

  it('shows an inline fallback when an image preview fails to load', () => {
    const doc = ['Intro', '', '![Missing](./fixtures/missing.png)'].join('\n')
    const view = makeView(doc, 0)

    const image = view.dom.querySelector('img.mf-image-widget')
    expect(image).not.toBeNull()

    fireEvent.error(image as Element)

    const fallback = view.dom.querySelector('.mf-image-error')
    expect(view.dom.querySelector('img.mf-image-widget')).toBeNull()
    expect(fallback).not.toBeNull()
    expect(fallback).toHaveTextContent('Missing')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('resolves local image sources while preserving already-addressable URLs', () => {
    expect(resolveImageSource('./assets/diagram.png', '/Users/pprp/docs/note.md')).toBe(
      'file:///Users/pprp/docs/assets/diagram.png',
    )
    expect(resolveImageSource('../shared/diagram.png', '/Users/pprp/docs/note.md')).toBe(
      'file:///Users/pprp/shared/diagram.png',
    )
    expect(resolveImageSource('https://example.com/image.png', '/Users/pprp/docs/note.md')).toBe(
      'https://example.com/image.png',
    )
    expect(resolveImageSource('/tmp/image.png', '/Users/pprp/docs/note.md')).toBe('file:///tmp/image.png')
    expect(resolveImageSource('C:\\Users\\pprp\\image.png', '/Users/pprp/docs/note.md')).toBe(
      'file:///C:/Users/pprp/image.png',
    )
    expect(resolveImageSource('file:///tmp/image.png', '/Users/pprp/docs/note.md')).toBe(
      'file:///tmp/image.png',
    )
    expect(resolveImageSource('data:image/png;base64,abc', '/Users/pprp/docs/note.md')).toBe(
      'data:image/png;base64,abc',
    )
    expect(resolveImageSource('//cdn.example.com/image.png', '/Users/pprp/docs/note.md')).toBe(
      '//cdn.example.com/image.png',
    )
  })
})
