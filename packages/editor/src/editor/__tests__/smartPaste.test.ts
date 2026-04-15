import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { smartPasteExtension } from '../extensions/smartPaste'

type ClipboardPayload = {
  files?: File[]
  html?: string
  text?: string
}

function makeView(doc = '', cursor = 0) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [smartPasteExtension()],
  })

  const parent = document.createElement('div')
  document.body.appendChild(parent)
  return new EditorView({ state, parent })
}

function dispatchShortcut(view: EditorView, options: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'v',
    ...options,
  })

  view.contentDOM.dispatchEvent(event)
}

function dispatchPaste(view: EditorView, payload: ClipboardPayload) {
  const event = new Event('paste', {
    bubbles: true,
    cancelable: true,
  })

  const clipboardData = {
    files: payload.files ?? [],
    types: [
      ...(payload.html !== undefined ? ['text/html'] : []),
      ...(payload.text !== undefined ? ['text/plain'] : []),
    ],
    getData(type: string) {
      if (type === 'text/html') {
        return payload.html ?? ''
      }

      if (type === 'text/plain') {
        return payload.text ?? ''
      }

      return ''
    },
  }

  Object.defineProperty(event, 'clipboardData', {
    value: clipboardData,
  })

  view.contentDOM.dispatchEvent(event)
  return event.defaultPrevented
}

describe('smartPasteExtension', () => {
  it('converts rich HTML paste to markdown on the default paste path', () => {
    const view = makeView()

    const handled = dispatchPaste(view, {
      html: '<strong>bold</strong>',
      text: 'bold',
    })

    expect(handled).toBe(true)
    expect(view.state.doc.toString()).toBe('**bold**')

    view.destroy()
  })

  it('uses plain text for Cmd/Ctrl+Shift+V instead of converting HTML', () => {
    const view = makeView()

    dispatchShortcut(view, { ctrlKey: true, shiftKey: true })
    const handled = dispatchPaste(view, {
      html: '<strong>bold</strong>',
      text: 'bold',
    })

    expect(handled).toBe(true)
    expect(view.state.doc.toString()).toBe('bold')

    view.destroy()
  })

  it('resets the plain-text shortcut after the matching paste', () => {
    const view = makeView()

    dispatchShortcut(view, { ctrlKey: true, shiftKey: true })
    dispatchPaste(view, {
      html: '<strong>bold</strong>',
      text: 'bold',
    })
    dispatchPaste(view, {
      html: '<strong>bold</strong>',
      text: 'bold',
    })

    expect(view.state.doc.toString()).toBe('bold**bold**')

    view.destroy()
  })

  it('preserves image paste handling on the normal paste path', () => {
    const view = makeView()
    const imageFile = new File(['image'], 'diagram.png', { type: 'image/png' })
    const pastedFiles: File[] = []

    view.dom.addEventListener('mf-image-paste', (event) => {
      pastedFiles.push((event as CustomEvent<{ file: File }>).detail.file)
    })

    const handled = dispatchPaste(view, {
      files: [imageFile],
    })

    expect(handled).toBe(true)
    expect(view.state.doc.toString()).toBe('![image](./diagram.png)')
    expect(pastedFiles).toEqual([imageFile])

    view.destroy()
  })
})
