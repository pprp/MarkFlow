export interface PlatformNavigator {
  readonly userAgentData?: {
    readonly platform?: string
  }
  readonly userAgent?: string
  readonly platform?: string
}

function namesMacPlatform(value: string | undefined) {
  return /\b(mac|macos|macintosh|macintel|macppc|mac68k)\b/i.test(value ?? '')
}

function namesMacUserAgent(value: string | undefined) {
  const normalizedValue = value ?? ''
  if (/\b(iphone|ipad|ipod|android)\b/i.test(normalizedValue)) {
    return false
  }

  return /\bmacintosh\b/i.test(normalizedValue)
}

export function isMacPlatform(navigatorLike: PlatformNavigator = navigator) {
  const userAgentDataPlatform = navigatorLike.userAgentData?.platform?.trim()
  if (userAgentDataPlatform) {
    return namesMacPlatform(userAgentDataPlatform)
  }

  const legacyPlatform = navigatorLike.platform?.trim()
  if (legacyPlatform) {
    return namesMacPlatform(legacyPlatform)
  }

  return namesMacUserAgent(navigatorLike.userAgent)
}
