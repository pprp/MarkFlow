import { fireEvent, render } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

function ensurePointerEventSupport() {
  if (window.PointerEvent) {
    return
  }

  class MockPointerEvent extends MouseEvent {
    pointerId: number

    constructor(type: string, params: PointerEventInit & { pointerId?: number } = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
    }
  }

  vi.stubGlobal('PointerEvent', MockPointerEvent)
}

function mockRect(element: Element, params: { left: number; top: number; width: number; height: number }) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: params.width,
      height: params.height,
      top: params.top,
      left: params.left,
      bottom: params.top + params.height,
      right: params.left + params.width,
      x: params.left,
      y: params.top,
      toJSON: () => {},
    }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('reveals resize handles and rewrites markdown with persisted image dimensions after drag-resize', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    ensurePointerEventSupport()

    const doc = ['Intro', '', '![Diagram](./fixtures/diagram.png)'].join('\n')
    const view = makeView(doc, 0)
    const shell = view.dom.querySelector('.mf-image-widget-shell') as HTMLElement
    const image = shell.querySelector('img.mf-image-widget') as HTMLImageElement
    const handle = shell.querySelector('.mf-image-resize-handle[data-handle="se"]') as HTMLElement

    expect(shell).not.toBeNull()
    expect(image).not.toBeNull()
    expect(handle).not.toBeNull()
    expect(shell.querySelectorAll('.mf-image-resize-handle')).toHaveLength(8)

    mockRect(shell, { left: 40, top: 20, width: 200, height: 100 })
    mockRect(image, { left: 40, top: 20, width: 200, height: 100 })

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 240, clientY: 120 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 340, clientY: 170 })

    expect(image.style.width).toBe('300px')
    expect(image.style.height).toBe('150px')

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 340, clientY: 170 })

    const resizedDoc = ['Intro', '', '![Diagram](./fixtures/diagram.png){width=300 height=150}'].join('\n')
    expect(view.state.doc.toString()).toBe(resizedDoc)

    const reopenedView = makeView(resizedDoc, 0)
    const reopenedImage = reopenedView.dom.querySelector('img.mf-image-widget') as HTMLImageElement
    expect(reopenedImage.style.width).toBe('300px')
    expect(reopenedImage.style.height).toBe('150px')

    destroyView(reopenedView)
    destroyView(view)
  })

  it('keeps resized image markdown editable when the caret moves into a persisted size attribute', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const doc = ['Intro', '', '![Diagram](./fixtures/diagram.png){width=300 height=150}'].join('\n')
    const view = makeView(doc, 0)

    expect(view.dom.querySelector('.mf-image-widget-shell')).not.toBeNull()

    view.dispatch({ selection: { anchor: doc.indexOf('width=300') } })

    expect(view.dom.querySelector('.mf-image-widget-shell')).toBeNull()
    expect(lineText(view, 2)).toContain('![Diagram](./fixtures/diagram.png){width=300 height=150}')

    destroyView(view)
  })

  it('applies existing Typora-style shorthand image size attributes on reopen', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const doc = ['Intro', '', '![Diagram](./fixtures/diagram.png)=240x120'].join('\n')
    const view = makeView(doc, 0)
    const image = view.dom.querySelector('img.mf-image-widget') as HTMLImageElement

    expect(image).not.toBeNull()
    expect(image.style.width).toBe('240px')
    expect(image.style.height).toBe('120px')
    expect(view.state.doc.toString()).toBe(doc)

    destroyView(view)
  })

  it('opens a draggable lightbox on image double-click and closes it without mutating the document', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    ensurePointerEventSupport()

    const doc = ['Intro', '', '![Diagram](./fixtures/diagram.png)', 'After'].join('\n')
    const view = makeView(doc, 0, '/Users/pprp/docs/note.md')
    const image = view.dom.querySelector('img.mf-image-widget') as HTMLImageElement

    expect(image).not.toBeNull()

    fireEvent.doubleClick(image)

    const overlay = document.body.querySelector('.mf-lightbox') as HTMLElement
    const lightboxImage = overlay.querySelector('.mf-lightbox-img') as HTMLImageElement
    const titleBar = overlay.querySelector('.mf-lightbox-titlebar') as HTMLElement
    let capturedPointerId: number | null = null

    titleBar.setPointerCapture = vi.fn((pointerId: number) => {
      capturedPointerId = pointerId
    })
    titleBar.releasePointerCapture = vi.fn((pointerId: number) => {
      if (capturedPointerId === pointerId) {
        capturedPointerId = null
      }
    })
    titleBar.hasPointerCapture = vi.fn((pointerId: number) => capturedPointerId === pointerId)

    expect(overlay).not.toBeNull()
    expect(lightboxImage.src).toBe('file:///Users/pprp/docs/fixtures/diagram.png')
    expect(view.state.doc.toString()).toBe(doc)

    mockRect(overlay, { left: 100, top: 40, width: 320, height: 240 })

    fireEvent.pointerDown(titleBar, { pointerId: 7, button: 0, clientX: 160, clientY: 80 })
    fireEvent.pointerMove(titleBar, { pointerId: 7, clientX: 260, clientY: 180 })
    fireEvent.pointerUp(titleBar, { pointerId: 7, clientX: 260, clientY: 180 })

    expect(overlay.style.left).toBe('200px')
    expect(overlay.style.top).toBe('140px')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.body.querySelector('.mf-lightbox')).toBeNull()
    expect(view.state.doc.toString()).toBe(doc)

    fireEvent.doubleClick(image)
    expect(document.body.querySelector('.mf-lightbox')).not.toBeNull()

    fireEvent.pointerDown(document.body, { pointerId: 9, clientX: 8, clientY: 8 })

    expect(document.body.querySelector('.mf-lightbox')).toBeNull()
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
