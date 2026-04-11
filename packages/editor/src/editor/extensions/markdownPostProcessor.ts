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
  return ViewPlugin.fromClass(
    class {
      private cleanup: (() => void) | null = null
      private frame: number | null = null

      constructor(view: EditorView) {
        this.scheduleRun(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.scheduleRun(update.view)
        }
      }

      destroy() {
        if (this.frame !== null) {
          cancelAnimationFrame(this.frame)
        }
        this.cleanup?.()
      }

      private scheduleRun(view: EditorView) {
        if (this.frame !== null) {
          cancelAnimationFrame(this.frame)
        }

        this.frame = requestAnimationFrame(() => {
          this.frame = null
          this.cleanup?.()
          this.cleanup = pluginHost.runMarkdownPostProcessors(view.contentDOM, {
            filePath,
            sourceText: view.state.doc.toString(),
            viewMode,
          })
        })
      }
    },
  )
}
