import {
  type Completion,
  CompletionContext,
  autocompletion,
  type CompletionSource,
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

interface EmojiEntry {
  glyph: string
  shortcode: string
}

const EMOJI_ENTRIES: readonly EmojiEntry[] = [
  { shortcode: 'grin', glyph: '\u{1F601}' },
  { shortcode: 'heart', glyph: '\u{2764}\u{FE0F}' },
  { shortcode: 'rocket', glyph: '\u{1F680}' },
  { shortcode: 'smile', glyph: '\u{1F604}' },
  { shortcode: 'smiley', glyph: '\u{1F603}' },
  { shortcode: 'sparkles', glyph: '\u{2728}' },
  { shortcode: 'tada', glyph: '\u{1F389}' },
  { shortcode: 'thinking', glyph: '\u{1F914}' },
  { shortcode: 'thumbs_up', glyph: '\u{1F44D}' },
  { shortcode: 'white_check_mark', glyph: '\u{2705}' },
] as const

const SHORTCODE_PATTERN = /:[a-z0-9_+-]*$/i

function toCompletion(entry: EmojiEntry): Completion {
  return {
    label: `:${entry.shortcode}:`,
    detail: entry.glyph,
    apply: entry.glyph,
    type: 'text',
  }
}

export function getEmojiCompletions(queryText: string): readonly Completion[] {
  const normalizedQuery = queryText.replace(/^:/, '').toLowerCase()
  const matches = normalizedQuery.length === 0
    ? EMOJI_ENTRIES
    : EMOJI_ENTRIES.filter((entry) => entry.shortcode.startsWith(normalizedQuery))

  return matches.map(toCompletion)
}

export const emojiCompletionSource: CompletionSource = (context: CompletionContext) => {
  const match = context.matchBefore(SHORTCODE_PATTERN)
  if (!match) {
    return null
  }

  const normalizedQuery = match.text.replace(/^:/, '')
  if (!context.explicit && normalizedQuery.length === 0) {
    return null
  }

  const options = getEmojiCompletions(match.text)
  if (options.length === 0) {
    return null
  }

  return {
    from: match.from,
    to: context.pos,
    options,
    filter: false,
  }
}

export function emojiAutocompleteExtension(): Extension {
  return autocompletion({
    activateOnTyping: true,
    activateOnTypingDelay: 0,
    icons: false,
    interactionDelay: 0,
    override: [emojiCompletionSource],
  })
}
