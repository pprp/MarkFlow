export const OUTLINE_PANEL_STORAGE_KEY = 'markflow.outline-panel.v1'

type PersistedOutlinePanelState = {
  collapsed: boolean
}

type LooseStorage = Storage & Record<string, unknown>

const fallbackStorage = new Map<string, string>()

export function loadLocalOutlinePanelCollapsedPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const raw = getStoredValue(window.localStorage, OUTLINE_PANEL_STORAGE_KEY)
    if (!raw) {
      return false
    }

    const parsed = JSON.parse(raw) as Partial<PersistedOutlinePanelState>
    return parsed.collapsed === true
  } catch {
    return false
  }
}

export function persistLocalOutlinePanelCollapsedPreference(collapsed: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState: PersistedOutlinePanelState = {
    collapsed,
  }

  setStoredValue(window.localStorage, OUTLINE_PANEL_STORAGE_KEY, JSON.stringify(nextState))
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
    // Fall back to in-memory persistence for constrained test environments.
  }

  fallbackStorage.set(key, value)
}
