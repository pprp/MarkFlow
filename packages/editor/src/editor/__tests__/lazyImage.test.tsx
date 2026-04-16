import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linkDecorations } from '../decorations/linkDecoration'

function makeView(doc: string, cursor = 0, filePath = '/Users/pprp/docs/note.md') {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage }), linkDecorations(filePath)],
  })
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function destroyView(view: EditorView) {
  view.dom.parentElement?.remove()
  view.destroy()
}

function findImageObserver(image: Element) {
  return MockIntersectionObserver.instances.find((observer) => observer.targets.has(image))
}

function requireImageObserver(image: Element) {
  const observer = findImageObserver(image)
  if (!observer) {
    throw new Error('Expected an IntersectionObserver instance for the image widget')
  }

  return observer
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  observe = vi.fn((target: Element) => {
    this.targets.add(target)
  })

  unobserve = vi.fn((target: Element) => {
    this.targets.delete(target)
  })

  disconnect = vi.fn(() => {
    this.targets.clear()
  })

  readonly targets = new Set<Element>()

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    MockIntersectionObserver.instances.push(this)
  }

  trigger(target: Element, isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    )
  }

  static reset() {
    MockIntersectionObserver.instances = []
  }
}

afterEach(() => {
  MockIntersectionObserver.reset()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('lazy-image decoration', () => {
  it('lazy-image defers src assignment until the image intersects the editor viewport', () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const view = makeView('Intro\n\n![Diagram](./fixtures/diagram.png)')
    const image = view.dom.querySelector('img.mf-image-widget') as HTMLImageElement
    const observer = requireImageObserver(image)

    expect(image).not.toBeNull()
    expect(image.getAttribute('src')).toBeNull()
    expect(observer.options?.root).toBe(view.scrollDOM)

    observer.trigger(image, false)
    expect(image.getAttribute('src')).toBeNull()

    observer.trigger(image, true)
    expect(image.getAttribute('src')).toBe('file:///Users/pprp/docs/fixtures/diagram.png')
    expect(observer.unobserve).toHaveBeenCalledWith(image)
    expect(observer.disconnect).toHaveBeenCalled()

    destroyView(view)
  })

  it('lazy-image falls back to immediate loading when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const view = makeView('Intro\n\n![Diagram](./fixtures/diagram.png)')
    const image = view.dom.querySelector('img.mf-image-widget') as HTMLImageElement

    expect(image).not.toBeNull()
    expect(image.getAttribute('src')).toBe('file:///Users/pprp/docs/fixtures/diagram.png')

    destroyView(view)
  })

  it('lazy-image disconnects its observer when the widget is removed before loading', () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const doc = 'Intro\n\n![Diagram](./fixtures/diagram.png)\nAfter'
    const view = makeView(doc)
    const image = view.dom.querySelector('img.mf-image-widget') as HTMLImageElement
    const observer = requireImageObserver(image)

    expect(image).not.toBeNull()

    view.dispatch({ selection: { anchor: doc.indexOf('Diagram') } })

    expect(view.dom.querySelector('img.mf-image-widget')).toBeNull()
    expect(observer.unobserve).toHaveBeenCalledWith(image)
    expect(observer.disconnect).toHaveBeenCalled()

    destroyView(view)
  })
})
