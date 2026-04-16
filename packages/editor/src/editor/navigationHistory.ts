export interface NavigationLocation {
  tabId: string | null
  filePath: string | null
  cursorPosition: number
  scrollTop: number | null
}

export interface NavigationHistoryState {
  entries: NavigationLocation[]
  currentIndex: number
}

export const MAX_NAVIGATION_HISTORY_ENTRIES = 64

function normalizeLocation(location: NavigationLocation): NavigationLocation {
  return {
    ...location,
    cursorPosition: Math.max(0, location.cursorPosition),
    scrollTop: typeof location.scrollTop === 'number' ? Math.max(0, location.scrollTop) : null,
  }
}

function cloneLocation(location: NavigationLocation): NavigationLocation {
  return { ...location }
}

function replaceCurrentEntry(
  state: NavigationHistoryState,
  currentLocation: NavigationLocation,
): NavigationHistoryState {
  const normalizedCurrent = normalizeLocation(currentLocation)
  const currentIndex =
    state.currentIndex >= 0
      ? Math.min(state.currentIndex, Math.max(state.entries.length - 1, 0))
      : state.entries.length > 0
        ? state.entries.length - 1
        : -1

  if (currentIndex < 0) {
    return {
      entries: [],
      currentIndex: -1,
    }
  }

  const entries = [...state.entries]
  entries[currentIndex] = normalizedCurrent
  return {
    entries,
    currentIndex,
  }
}

export function createEmptyNavigationHistory(): NavigationHistoryState {
  return {
    entries: [],
    currentIndex: -1,
  }
}

export function locationsEqual(left: NavigationLocation, right: NavigationLocation): boolean {
  return (
    left.tabId === right.tabId &&
    left.filePath === right.filePath &&
    left.cursorPosition === right.cursorPosition &&
    left.scrollTop === right.scrollTop
  )
}

export function canNavigateBack(state: NavigationHistoryState): boolean {
  return state.currentIndex > 0
}

export function canNavigateForward(state: NavigationHistoryState): boolean {
  return state.currentIndex >= 0 && state.currentIndex < state.entries.length - 1
}

export function pushNavigationHistoryEntry(
  state: NavigationHistoryState,
  currentLocation: NavigationLocation,
  destination: NavigationLocation,
  maxEntries: number = MAX_NAVIGATION_HISTORY_ENTRIES,
): NavigationHistoryState {
  const normalizedCurrent = normalizeLocation(currentLocation)
  const normalizedDestination = normalizeLocation(destination)

  let entries =
    state.currentIndex >= 0 ? state.entries.slice(0, state.currentIndex + 1) : [...state.entries]
  let currentIndex = state.currentIndex

  if (entries.length === 0 || currentIndex < 0) {
    entries = [normalizedCurrent]
    currentIndex = 0
  } else {
    entries[currentIndex] = normalizedCurrent
  }

  if (locationsEqual(entries[currentIndex], normalizedDestination)) {
    return {
      entries,
      currentIndex,
    }
  }

  entries = [...entries, normalizedDestination]
  currentIndex = entries.length - 1

  if (entries.length > maxEntries) {
    const overflow = entries.length - maxEntries
    entries = entries.slice(overflow)
    currentIndex = Math.max(0, currentIndex - overflow)
  }

  return {
    entries,
    currentIndex,
  }
}

export function navigateBackInHistory(
  state: NavigationHistoryState,
  currentLocation: NavigationLocation,
): { history: NavigationHistoryState; target: NavigationLocation | null } {
  const updatedState = replaceCurrentEntry(state, currentLocation)
  if (!canNavigateBack(updatedState)) {
    return {
      history: updatedState,
      target: null,
    }
  }

  const nextIndex = updatedState.currentIndex - 1
  return {
    history: {
      entries: updatedState.entries,
      currentIndex: nextIndex,
    },
    target: cloneLocation(updatedState.entries[nextIndex]),
  }
}

export function navigateForwardInHistory(
  state: NavigationHistoryState,
  currentLocation: NavigationLocation,
): { history: NavigationHistoryState; target: NavigationLocation | null } {
  const updatedState = replaceCurrentEntry(state, currentLocation)
  if (!canNavigateForward(updatedState)) {
    return {
      history: updatedState,
      target: null,
    }
  }

  const nextIndex = updatedState.currentIndex + 1
  return {
    history: {
      entries: updatedState.entries,
      currentIndex: nextIndex,
    },
    target: cloneLocation(updatedState.entries[nextIndex]),
  }
}
