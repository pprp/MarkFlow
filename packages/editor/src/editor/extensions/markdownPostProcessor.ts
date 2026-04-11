import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import type { MarkFlowPluginHost, MarkFlowRenderedViewMode } from '@markflow/shared'

interface MarkdownPostProcessorExtensionOptions {
  filePath?: string
  pluginHost: MarkFlowPluginHost
  viewMode: MarkFlowRenderedViewMode
}

export function markdownPostProcessorExtension({
  filePath,
  pluginHost,
  viewMode,
}: MarkdownPostProcessorExtensionOptions) {
  class MarkdownPostProcessorPlugin {
    _cleanup: (() => void) | null = null
    _frame: number | null = null

    constructor(view: EditorView) {
      this._scheduleRun(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this._scheduleRun(update.view)
      }
    }

    destroy() {
      if (this._frame !== null) {
        cancelAnimationFrame(this._frame)
      }
      this._cleanup?.()
    }

    _scheduleRun(view: EditorView) {
      if (this._frame !== null) {
        cancelAnimationFrame(this._frame)
      }

      this._frame = requestAnimationFrame(() => {
        this._frame = null
        this._cleanup?.()
        this._cleanup = pluginHost.runMarkdownPostProcessors(view.contentDOM, {
          filePath,
          sourceText: view.state.doc.toString(),
          viewMode,
        })
      })
    }
  }

  return ViewPlugin.fromClass(MarkdownPostProcessorPlugin)
}
