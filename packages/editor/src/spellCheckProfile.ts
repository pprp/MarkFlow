import type { MarkFlowSpellCheckState } from '@markflow/shared'

const SPELLCHECK_STORAGE_KEY = 'markflow.spellcheck-profile.v1'
const FALLBACK_SPELLCHECK_LANGUAGES = ['de-DE', 'en-GB', 'en-US', 'es-ES', 'fr-FR']

type PersistedSpellCheckState = Pick<MarkFlowSpellCheckState, 'selectedLanguage' | 'customWords'>

function sortUniqueLanguages(languages: readonly string[]) {
  const nextLanguages = [...new Set(languages.filter((language) => language.trim().length > 0))]
  return nextLanguages.sort((left, right) => left.localeCompare(right))
}

function sortUniqueWords(words: readonly string[]) {
  const nextWords = new Map<string, string>()

  for (const word of words) {
    const normalized = sanitizeSpellCheckWord(word)
    if (!normalized) {
      continue
    }

    const key = normalized.toLocaleLowerCase()
    if (!nextWords.has(key)) {
      nextWords.set(key, normalized)
    }
  }

  return [...nextWords.values()].sort((left, right) => left.localeCompare(right))
}

export function sanitizeSpellCheckWord(word: string) {
  const trimmed = word.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeSpellCheckState(
  state: Partial<MarkFlowSpellCheckState> | null | undefined,
): MarkFlowSpellCheckState {
  const availableLanguages = sortUniqueLanguages(
    Array.isArray(state?.availableLanguages) && state.availableLanguages.length > 0
      ? state.availableLanguages
      : FALLBACK_SPELLCHECK_LANGUAGES,
  )

  const selectedLanguage =
    state?.selectedLanguage && availableLanguages.includes(state.selectedLanguage)
      ? state.selectedLanguage
      : null

  return {
    selectedLanguage,
    availableLanguages,
    customWords: sortUniqueWords(state?.customWords ?? []),
  }
}

export function loadLocalSpellCheckState() {
  if (typeof window === 'undefined') {
    return normalizeSpellCheckState(null)
  }

  try {
    const raw = window.localStorage.getItem(SPELLCHECK_STORAGE_KEY)
    if (!raw) {
      return normalizeSpellCheckState(null)
    }

    return normalizeSpellCheckState(JSON.parse(raw) as PersistedSpellCheckState)
  } catch {
    return normalizeSpellCheckState(null)
  }
}

export function persistLocalSpellCheckState(state: MarkFlowSpellCheckState) {
  if (typeof window === 'undefined') {
    return
  }

  const persistedState: PersistedSpellCheckState = {
    selectedLanguage: state.selectedLanguage,
    customWords: [...state.customWords],
  }

  window.localStorage.setItem(SPELLCHECK_STORAGE_KEY, JSON.stringify(persistedState))
}
