import { describe, expect, it } from 'vitest'
import {
  MAX_NAVIGATION_HISTORY_ENTRIES,
  canNavigateBack,
  canNavigateForward,
  createEmptyNavigationHistory,
  navigateBackInHistory,
  navigateForwardInHistory,
  pushNavigationHistoryEntry,
  type NavigationLocation,
} from '../navigationHistory'

function location(
  filePath: string,
  cursorPosition: number,
  scrollTop: number | null,
  tabId: string = filePath,
): NavigationLocation {
  return {
    tabId,
    filePath,
    cursorPosition,
    scrollTop,
  }
}

describe('navigationHistory', () => {
  it('pushes the current location and destination onto the stack', () => {
    const start = location('/docs/alpha.md', 3, 24)
    const destination = location('/docs/alpha.md', 48, null)

    const history = pushNavigationHistoryEntry(
      createEmptyNavigationHistory(),
      start,
      destination,
    )

    expect(history.entries).toEqual([start, destination])
    expect(history.currentIndex).toBe(1)
    expect(canNavigateBack(history)).toBe(true)
    expect(canNavigateForward(history)).toBe(false)
  })

  it('moves backward and forward while preserving the latest location left behind', () => {
    const start = location('/docs/alpha.md', 3, 24)
    const middle = location('/docs/alpha.md', 48, 180)
    const end = location('/docs/beta.md', 12, 96)

    const pushedOnce = pushNavigationHistoryEntry(createEmptyNavigationHistory(), start, middle)
    const pushedTwice = pushNavigationHistoryEntry(pushedOnce, middle, end)

    const movedMiddle = location('/docs/beta.md', 18, 144)
    const backResult = navigateBackInHistory(pushedTwice, movedMiddle)

    expect(backResult.target).toEqual(middle)
    expect(backResult.history.entries[2]).toEqual(movedMiddle)
    expect(backResult.history.currentIndex).toBe(1)
    expect(canNavigateForward(backResult.history)).toBe(true)

    const movedBackToMiddle = location('/docs/alpha.md', 50, 220)
    const forwardResult = navigateForwardInHistory(backResult.history, movedBackToMiddle)

    expect(forwardResult.target).toEqual(movedMiddle)
    expect(forwardResult.history.entries[1]).toEqual(movedBackToMiddle)
    expect(forwardResult.history.currentIndex).toBe(2)
  })

  it('branches from the current index and drops the stale forward branch', () => {
    const start = location('/docs/alpha.md', 0, 0)
    const middle = location('/docs/alpha.md', 64, null)
    const oldForward = location('/docs/beta.md', 8, 16)

    const withForwardBranch = pushNavigationHistoryEntry(
      pushNavigationHistoryEntry(createEmptyNavigationHistory(), start, middle),
      middle,
      oldForward,
    )
    const backResult = navigateBackInHistory(withForwardBranch, oldForward)
    const branchedDestination = location('/docs/gamma.md', 21, null)

    const branched = pushNavigationHistoryEntry(
      backResult.history,
      middle,
      branchedDestination,
    )

    expect(branched.entries).toEqual([start, middle, branchedDestination])
    expect(branched.currentIndex).toBe(2)
  })

  it('caps history at the configured depth and trims the oldest entries', () => {
    let history = createEmptyNavigationHistory()

    for (let index = 0; index < MAX_NAVIGATION_HISTORY_ENTRIES + 6; index += 1) {
      const current = location(`/docs/${index}.md`, index, index * 10)
      const destination = location(`/docs/${index + 1}.md`, index + 1, (index + 1) * 10)
      history = pushNavigationHistoryEntry(history, current, destination)
    }

    expect(history.entries).toHaveLength(MAX_NAVIGATION_HISTORY_ENTRIES)
    expect(history.currentIndex).toBe(MAX_NAVIGATION_HISTORY_ENTRIES - 1)
    expect(history.entries[0]?.filePath).toBe('/docs/7.md')
    expect(history.entries.at(-1)?.filePath).toBe(`/docs/${MAX_NAVIGATION_HISTORY_ENTRIES + 6}.md`)
  })
})
