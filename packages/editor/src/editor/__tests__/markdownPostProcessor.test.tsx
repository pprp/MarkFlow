import { render, waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { MarkFlowPluginHost, type MarkFlowPlugin } from '@markflow/shared'
import { MarkFlowEditor } from '../MarkFlowEditor'
import { createExternalLinkBadgePlugin } from '../../plugins/externalLinkBadgePlugin'

function getEditorView(container: HTMLElement) {
  const editorRoot = container.querySelector('.cm-editor')
  expect(editorRoot).not.toBeNull()

  const view = EditorView.findFromDOM(editorRoot as HTMLElement)
  expect(view).not.toBeNull()

  return view as EditorView
}

describe('markdown post-processors', () => {
  it('registers, runs, and unloads plugin post-processors', () => {
    const host = new MarkFlowPluginHost()
    const onload = vi.fn()
    const onunload = vi.fn()
    const process = vi.fn()
    const cleanup = vi.fn()

    const plugin: MarkFlowPlugin = {
      id: 'test-plugin',
      onload(context) {
        onload()
        return context.registerMarkdownPostProcessor({
          selector: '.target',
          process(element, runtime) {
            process(runtime.viewMode, runtime.sourceText)
            element.classList.add('processed')
            return () => {
              cleanup()
              element.classList.remove('processed')
            }
          },
        })
      },
      onunload,
    }

    host.load(plugin)
    expect(onload).toHaveBeenCalledTimes(1)
    expect(host.getMarkdownPostProcessorCount()).toBe(1)

    const root = document.createElement('div')
    root.innerHTML = '<a class="target">Docs</a>'

    const disposeProcessors = host.runMarkdownPostProcessors(root, {
      sourceText: '[Docs](https://example.com)',
      viewMode: 'wysiwyg',
    })

    expect(process).toHaveBeenCalledWith('wysiwyg', '[Docs](https://example.com)')
    expect(root.querySelector('.target')).toHaveClass('processed')

    disposeProcessors()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(root.querySelector('.target')).not.toHaveClass('processed')

    host.unload(plugin.id)
    expect(onunload).toHaveBeenCalledTimes(1)
    expect(host.getMarkdownPostProcessorCount()).toBe(0)
  })

  it('applies the sample plugin without mutating the markdown source', async () => {
    const pluginHost = new MarkFlowPluginHost()
    pluginHost.setPlugins([createExternalLinkBadgePlugin()])

    const { container } = render(
      <MarkFlowEditor
        content="See [Docs](https://example.com)"
        viewMode="wysiwyg"
        onChange={vi.fn()}
        pluginHost={pluginHost}
      />,
    )

    const view = getEditorView(container)

    await waitFor(() => {
      const link = container.querySelector('a.mf-link')
      expect(link).toHaveAttribute('data-mf-link-kind', 'external')
      expect(link).toHaveClass('mf-link-external')
    })
    expect(view.state.doc.toString()).toBe('See [Docs](https://example.com)')

    view.dispatch({
      changes: { from: 0, insert: 'Now ' },
    })

    await waitFor(() => {
      expect(container.querySelectorAll('a.mf-link.mf-link-external')).toHaveLength(1)
    })
    expect(view.state.doc.toString()).toBe('Now See [Docs](https://example.com)')
  })
})
