import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadMacSmartInputModules() {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')

  const [{ EditorState }, { EditorView }, { smartInput }, { markdown, markdownLanguage }] =
    await Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('../extensions/smartInput'),
      import('@codemirror/lang-markdown'),
    ])

  return { EditorState, EditorView, smartInput, markdown, markdownLanguage }
}

function dispatchEditorShortcutOnDom(
  view: import('@codemirror/view').EditorView,
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

  view.contentDOM.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('smartInput macOS paragraph scaffold shortcuts', () => {
  it.each([
    [
      'Cmd+Opt+T',
      { key: 't', code: 'KeyT', keyCode: 84, metaKey: true, altKey: true },
      ['|  |  |', '| --- | --- |', '|  |  |'].join('\n'),
      2,
    ],
    [
      'Cmd+Opt+C',
      { key: 'c', code: 'KeyC', keyCode: 67, metaKey: true, altKey: true },
      ['```', '', '```'].join('\n'),
      4,
    ],
    [
      'Cmd+Opt+B',
      { key: 'b', code: 'KeyB', keyCode: 66, metaKey: true, altKey: true },
      ['$$', '', '$$'].join('\n'),
      3,
    ],
  ])(
    'supports %s when the editor runs on a macOS platform',
    async (_label, shortcut, expectedDoc, expectedCursor) => {
      const { EditorState, EditorView, smartInput, markdown, markdownLanguage } =
        await loadMacSmartInputModules()

      const state = EditorState.create({
        doc: 'Plain paragraph',
        selection: { anchor: 6 },
        extensions: [markdown({ base: markdownLanguage }), smartInput({ isWysiwygMode: () => true })],
      })
      const parent = document.createElement('div')
      document.body.appendChild(parent)
      const view = new EditorView({ state, parent })

      const event = dispatchEditorShortcutOnDom(view, shortcut)

      expect(event.defaultPrevented).toBe(true)
      expect(view.state.doc.toString()).toBe(expectedDoc)
      expect(view.state.selection.main.from).toBe(expectedCursor)
      expect(view.state.selection.main.to).toBe(expectedCursor)

      view.destroy()
    },
  )
})
