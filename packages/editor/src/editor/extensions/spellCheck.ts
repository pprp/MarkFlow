import { EditorView, Decoration, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Builds a decoration set that marks code/link regions with spellcheck=false
 * so the browser skips spell checking inside code and links.
 */
function buildSpellCheckExclusions(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const noSpellCheck = Decoration.mark({ attributes: { spellcheck: 'false' } })

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const name = node.type.name
        if (
          name === 'InlineCode' ||
          name === 'FencedCode' ||
          name === 'CodeBlock' ||
          name === 'Link' ||
          name === 'URL'
        ) {
          builder.add(node.from, node.to, noSpellCheck)
        }
      },
    })
  }

  return builder.finish()
}

const spellCheckExclusionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildSpellCheckExclusions(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildSpellCheckExclusions(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/**
 * Spell check extension: enables browser native spell checking on the editor
 * but excludes code blocks, inline code, and links from spell checking.
 */
export function spellCheckExtension() {
  return [
    EditorView.contentAttributes.of({ spellcheck: 'true' }),
    spellCheckExclusionPlugin,
  ]
}
