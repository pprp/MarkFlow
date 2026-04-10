export interface PreventableNavigationEvent {
  preventDefault: () => void
}

export interface WindowOpenDetails {
  url: string
}

export function isAppNavigation(url: string) {
  return url.startsWith('http://localhost') || url.startsWith('file://')
}

export function handleWillNavigate(
  event: PreventableNavigationEvent,
  url: string,
  openExternal: (url: string) => void | Promise<void>,
) {
  if (isAppNavigation(url)) {
    return
  }

  event.preventDefault()
  void openExternal(url)
}

export function createWindowOpenHandler(openExternal: (url: string) => void | Promise<void>) {
  return ({ url }: WindowOpenDetails) => {
    void openExternal(url)
    return { action: 'deny' as const }
  }
}
