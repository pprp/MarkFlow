import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'

export class LanguageBadgeWidget extends WidgetType {
  constructor(readonly lang: string) {
    super()
  }

  toDOM() {
    const header = document.createElement('span')
    header.className = 'mf-code-block-header'
    const badge = document.createElement('span')
    badge.className = 'mf-code-lang-badge'
    badge.textContent = this.lang
    header.appendChild(badge)
    return header
  }

  eq(other: LanguageBadgeWidget) {
    return this.lang === other.lang
  }
}

export function buildCodeBlockDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const cursorHead = view.state.selection.main.head
  const doc = view.state.doc

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return

      // Skip fenced blocks that have dedicated renderers (e.g. mermaid diagrams).
      const infoNode = node.node.getChild('CodeInfo')
      let lang = ''
      if (infoNode) {
        lang = doc.sliceString(infoNode.from, infoNode.to).trim().toLowerCase()
        if (lang === 'mermaid') return
      }

      const { from, to } = node
      const cursorInside = cursorHead >= from && cursorHead <= to

      const firstLine = doc.lineAt(from)
      const lastLine = doc.lineAt(to)

      if (!cursorInside) {
        if (lang) {
          builder.add(
            firstLine.from,
            firstLine.to,
            Decoration.replace({ widget: new LanguageBadgeWidget(lang) }),
          )
        } else {
          builder.add(firstLine.from, firstLine.to, Decoration.replace({}))
        }
      }

      // Style content lines (always skip the fence lines themselves)
      for (let lineNum = firstLine.number + 1; lineNum <= lastLine.number - 1; lineNum++) {
        const line = doc.line(lineNum)
        const classes = ['mf-code-block-line']
        if (lineNum === firstLine.number + 1) {
          classes.push('mf-code-block-first')
          if (lang) classes.push('mf-code-block-with-lang')
        }
        if (lineNum === lastLine.number - 1) classes.push('mf-code-block-last')
        const attrs: Record<string, string> | undefined = lang ? { 'data-lang': lang } : undefined
        builder.add(
          line.from,
          line.from,
          Decoration.line({ class: classes.join(' '), attributes: attrs }),
        )
      }

      if (!cursorInside && lastLine.from !== firstLine.from) {
        builder.add(lastLine.from, lastLine.to, Decoration.replace({}))
      }
    },
  })

  return builder.finish()
}

export function codeBlockDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildCodeBlockDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildCodeBlockDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
