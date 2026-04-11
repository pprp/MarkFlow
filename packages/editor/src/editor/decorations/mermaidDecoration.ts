import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

// ── Mermaid lazy loader ───────────────────────────────────────────────────────

// Mermaid is a large library — load it once on first use.
let mermaidReady: Promise<typeof import('mermaid').default> | null = null

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({ startOnLoad: false, theme: 'default' })
      return m
    })
  }
  return mermaidReady
}

// ── SVG cache ─────────────────────────────────────────────────────────────────

/** Avoid re-computing identical diagrams. */
const svgCache = new Map<string, string>()
let renderSerial = 0

function formatMermaidError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `Invalid Mermaid syntax: ${error.message.trim()}`
  }

  return 'Invalid Mermaid syntax. Switch to Source mode to edit this block.'
}

// ── Widget ────────────────────────────────────────────────────────────────────

export class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    private readonly view: EditorView,
  ) {
    super()
  }

  eq(other: MermaidWidget) {
    // View reference is intentionally excluded from equality check.
    return other.source === this.source
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = 'mf-mermaid'

    const cached = svgCache.get(this.source)
    if (cached) {
      container.innerHTML = cached
      return container
    }

    container.innerHTML = '<div class="mf-mermaid-loading">⟳ Rendering diagram…</div>'

    const id = `mf-mermaid-${renderSerial++}`
    const view = this.view
    getMermaid()
      .then((m) => m.render(id, this.source))
      .then(({ svg }) => {
        svgCache.set(this.source, svg)
        container.innerHTML = svg
        // Tell CodeMirror the widget height changed so it can re-measure layout.
        view.requestMeasure()
      })
      .catch((error) => {
        const errorBox = document.createElement('div')
        errorBox.className = 'mf-mermaid-error'
        errorBox.textContent = formatMermaidError(error)
        container.replaceChildren(errorBox)
        view.requestMeasure()
      })

    return container
  }

  ignoreEvent() {
    return false
  }
}

// ── Decoration builder ────────────────────────────────────────────────────────

export function buildMermaidDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return

      const { from, to } = node

      // Identify the language from the CodeInfo child node.
      const infoNode = node.node.getChild('CodeInfo')
      if (!infoNode) return

      const lang = doc.sliceString(infoNode.from, infoNode.to).trim().toLowerCase()
      if (lang !== 'mermaid') return

      // Get diagram source from the CodeText child node.
      const textNode = node.node.getChild('CodeText')
      if (!textNode) return
      const source = doc.sliceString(textNode.from, textNode.to)

      const firstLine = doc.lineAt(from)
      const lastLine = doc.lineAt(to)

      // Replace the opening fence line with the rendered widget.
      builder.add(
        firstLine.from,
        firstLine.to,
        Decoration.replace({ widget: new MermaidWidget(source, view) }),
      )

      // Hide content lines (preserve line nodes to keep CM6 layout intact).
      for (let lineNum = firstLine.number + 1; lineNum <= lastLine.number - 1; lineNum++) {
        const line = doc.line(lineNum)
        builder.add(line.from, line.to, Decoration.replace({}))
      }

      // Hide closing fence line.
      if (lastLine.from !== firstLine.from) {
        builder.add(lastLine.from, lastLine.to, Decoration.replace({}))
      }
    },
  })

  return builder.finish()
}

// ── Extension ─────────────────────────────────────────────────────────────────

export function mermaidDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildMermaidDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildMermaidDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
