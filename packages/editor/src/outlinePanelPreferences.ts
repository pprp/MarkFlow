export const OUTLINE_PANEL_STORAGE_KEY = 'markflow.outline-panel.v1'

export type OutlineDisplayMode = 'flat' | 'collapsible'

type PersistedOutlinePanelState = {
  collapsed: boolean
  displayMode?: OutlineDisplayMode
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

export function loadLocalOutlinePanelDisplayModePreference(): OutlineDisplayMode {
  if (typeof window === 'undefined') {
    return 'flat'
  }

  try {
    const raw = getStoredValue(window.localStorage, OUTLINE_PANEL_STORAGE_KEY)
    if (!raw) {
      return 'flat'
    }

    const parsed = JSON.parse(raw) as Partial<PersistedOutlinePanelState>
    return parsed.displayMode === 'collapsible' ? 'collapsible' : 'flat'
  } catch {
    return 'flat'
  }
}

export function persistLocalOutlinePanelCollapsedPreference(collapsed: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState = loadStoredOutlinePanelState(window.localStorage)
  nextState.collapsed = collapsed

  persistStoredOutlinePanelState(window.localStorage, nextState)
}

export function persistLocalOutlinePanelDisplayModePreference(displayMode: OutlineDisplayMode) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState = loadStoredOutlinePanelState(window.localStorage)
  nextState.displayMode = displayMode

  persistStoredOutlinePanelState(window.localStorage, nextState)
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

function loadStoredOutlinePanelState(storage: LooseStorage): PersistedOutlinePanelState {
  try {
    const raw = getStoredValue(storage, OUTLINE_PANEL_STORAGE_KEY)
    if (!raw) {
      return { collapsed: false, displayMode: 'flat' }
    }

    const parsed = JSON.parse(raw) as Partial<PersistedOutlinePanelState>
    return {
      collapsed: parsed.collapsed === true,
      displayMode: parsed.displayMode === 'collapsible' ? 'collapsible' : 'flat',
    }
  } catch {
    return { collapsed: false, displayMode: 'flat' }
  }
}

function persistStoredOutlinePanelState(storage: LooseStorage, state: PersistedOutlinePanelState) {
  setStoredValue(storage, OUTLINE_PANEL_STORAGE_KEY, JSON.stringify(state))
}
