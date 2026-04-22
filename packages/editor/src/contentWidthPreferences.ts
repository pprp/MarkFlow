const WIDTH_STORAGE_KEY = 'mf-content-width'
const WIDTH_MIN = 400
const WIDTH_MAX = 1400
const WIDTH_DEFAULT = 720

export function loadLocalContentWidthPreference(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    if (!raw) return WIDTH_DEFAULT
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed)) return WIDTH_DEFAULT
    return clampWidth(parsed)
  } catch {
    return WIDTH_DEFAULT
  }
}

export function persistLocalContentWidthPreference(width: number): void {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Ignore unavailable storage so width changes stay in-memory.
  }
}

export function clampWidth(width: number): number {
  return Math.round(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, width)))
}

export { WIDTH_MIN, WIDTH_MAX, WIDTH_DEFAULT }
