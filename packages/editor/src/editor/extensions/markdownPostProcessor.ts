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
    _sourceText: string

    constructor(view: EditorView) {
      this._sourceText = view.state.doc.toString()
      this._scheduleRun(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this._sourceText = update.state.doc.toString()
      }

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
          sourceText: this._sourceText,
          viewMode,
        })
      })
    }
  }

  return ViewPlugin.fromClass(MarkdownPostProcessorPlugin)
}
