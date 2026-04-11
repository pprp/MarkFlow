import { describe, expect, it, vi } from 'vitest'
import { createWindowOpenHandler, handleWillNavigate, isAppNavigation } from './externalLinks'

describe('external link handling', () => {
  it('keeps local editor navigations inside the app', () => {
    expect(isAppNavigation('http://localhost:5173')).toBe(true)
    expect(isAppNavigation('file:///tmp/notes.md')).toBe(true)
    expect(isAppNavigation('https://example.com')).toBe(false)
  })

  it('blocks in-app navigation and opens external urls in the system browser', () => {
    const preventDefault = vi.fn()
    const openExternal = vi.fn()

    handleWillNavigate({ preventDefault }, 'https://example.com', openExternal)

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('denies window.open and delegates to the system browser', () => {
    const openExternal = vi.fn()

    const result = createWindowOpenHandler(openExternal)({ url: 'https://example.com' })

    expect(openExternal).toHaveBeenCalledWith('https://example.com')
    expect(result).toEqual({ action: 'deny' })
  })

  it('denies app-local window.open calls without handing them to the system browser', () => {
    const openExternal = vi.fn()

    const result = createWindowOpenHandler(openExternal)({ url: 'file:///tmp/notes.md' })

    expect(openExternal).not.toHaveBeenCalled()
    expect(result).toEqual({ action: 'deny' })
  })
})
