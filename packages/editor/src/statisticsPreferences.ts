export const STATISTICS_PREFERENCES_STORAGE_KEY = 'markflow.statistics-preferences.v1'

export interface MarkFlowStatisticsPreferences {
  excludeFencedCode: boolean
}

type PersistedStatisticsPreferences = Partial<MarkFlowStatisticsPreferences>
type LooseStorage = Storage & Record<string, unknown>

const fallbackStorage = new Map<string, string>()

const DEFAULT_STATISTICS_PREFERENCES: MarkFlowStatisticsPreferences = {
  excludeFencedCode: true,
}

export function loadLocalStatisticsPreferences(): MarkFlowStatisticsPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_STATISTICS_PREFERENCES
  }

  try {
    const raw = getStoredValue(window.localStorage, STATISTICS_PREFERENCES_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_STATISTICS_PREFERENCES
    }

    const parsed = JSON.parse(raw) as PersistedStatisticsPreferences
    return {
      excludeFencedCode: parsed.excludeFencedCode !== false,
    }
  } catch {
    return DEFAULT_STATISTICS_PREFERENCES
  }
}

export function persistLocalStatisticsPreferences(preferences: MarkFlowStatisticsPreferences) {
  if (typeof window === 'undefined') {
    return
  }

  setStoredValue(window.localStorage, STATISTICS_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

function getStoredValue(storage: LooseStorage, key: string) {
  try {
    if (typeof storage.getItem === 'function') {
      const value = storage.getItem(key)
      if (value != null) {
        fallbackStorage.set(key, value)
      }
      return value ?? fallbackStorage.get(key) ?? null
    }
  } catch {
    return fallbackStorage.get(key) ?? null
  }

  return fallbackStorage.get(key) ?? null
}

function setStoredValue(storage: LooseStorage, key: string, value: string) {
  try {
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, value)
    }
  } catch {
    // Fall back to an in-memory store for constrained test environments.
  }

  fallbackStorage.set(key, value)
}
