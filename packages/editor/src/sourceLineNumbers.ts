export const SOURCE_LINE_NUMBERS_STORAGE_KEY = 'markflow.source-line-numbers.v1'

type PersistedSourceLineNumbersState = {
  enabled: boolean
}

type LooseStorage = Storage & Record<string, unknown>
const fallbackStorage = new Map<string, string>()

export function loadLocalSourceLineNumbersPreference() {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const raw = getStoredValue(window.localStorage, SOURCE_LINE_NUMBERS_STORAGE_KEY)
    if (!raw) {
      return true
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSourceLineNumbersState>
    return parsed.enabled !== false
  } catch {
    return true
  }
}

export function persistLocalSourceLineNumbersPreference(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState: PersistedSourceLineNumbersState = {
    enabled,
  }

  setStoredValue(window.localStorage, SOURCE_LINE_NUMBERS_STORAGE_KEY, JSON.stringify(nextState))
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
