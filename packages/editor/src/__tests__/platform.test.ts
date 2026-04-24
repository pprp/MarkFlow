import { describe, expect, it } from 'vitest'
import { isMacPlatform, type PlatformNavigator } from '../platform'

describe('platform detection', () => {
  it('uses navigator.userAgentData platform before legacy navigator.platform', () => {
    const navigatorLike: PlatformNavigator = {
      userAgentData: { platform: 'macOS' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32',
    }

    expect(isMacPlatform(navigatorLike)).toBe(true)
  })

  it('falls back to the user agent when navigator.platform is empty', () => {
    const navigatorLike: PlatformNavigator = {
      userAgentData: { platform: '' },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15',
      platform: '',
    }

    expect(isMacPlatform(navigatorLike)).toBe(true)
  })

  it('keeps non-macOS platforms on Ctrl shortcut handling', () => {
    const navigatorLike: PlatformNavigator = {
      userAgentData: { platform: 'Windows' },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'MacIntel',
    }

    expect(isMacPlatform(navigatorLike)).toBe(false)
  })

  it('does not treat mobile user agents as macOS when navigator.platform is empty', () => {
    const navigatorLike: PlatformNavigator = {
      userAgentData: { platform: '' },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      platform: '',
    }

    expect(isMacPlatform(navigatorLike)).toBe(false)
  })
})
