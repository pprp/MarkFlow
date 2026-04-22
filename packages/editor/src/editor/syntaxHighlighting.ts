import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const markFlowHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: 'var(--mf-syntax-meta)' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.heading, textDecoration: 'underline', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.keyword, color: 'var(--mf-syntax-keyword)' },
  {
    tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName],
    color: 'var(--mf-syntax-constant)',
  },
  { tag: [tags.literal, tags.inserted], color: 'var(--mf-syntax-literal)' },
  { tag: [tags.string, tags.deleted], color: 'var(--mf-syntax-string)' },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    color: 'var(--mf-syntax-special)',
  },
  { tag: tags.definition(tags.variableName), color: 'var(--mf-syntax-definition)' },
  { tag: tags.local(tags.variableName), color: 'var(--mf-syntax-variable)' },
  { tag: [tags.typeName, tags.namespace], color: 'var(--mf-syntax-type)' },
  { tag: tags.className, color: 'var(--mf-syntax-class)' },
  {
    tag: [tags.special(tags.variableName), tags.macroName],
    color: 'var(--mf-syntax-special-variable)',
  },
  { tag: tags.definition(tags.propertyName), color: 'var(--mf-syntax-property)' },
  { tag: tags.comment, color: 'var(--mf-syntax-comment)' },
  { tag: tags.invalid, color: 'var(--mf-syntax-invalid)' },
])

export function markFlowSyntaxHighlighting() {
  return syntaxHighlighting(markFlowHighlightStyle, { fallback: true })
}
