const ZOOM_STORAGE_KEY = 'mf-zoom-level'
const ZOOM_MIN = 0.7
const ZOOM_MAX = 2.0
const ZOOM_STEP = 0.1
const ZOOM_DEFAULT = 1.0

export function loadLocalZoomPreference(): number {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (!raw) return ZOOM_DEFAULT
    const parsed = parseFloat(raw)
    if (isNaN(parsed)) return ZOOM_DEFAULT
    return clampZoom(parsed)
  } catch {
    return ZOOM_DEFAULT
  }
}

export function persistLocalZoomPreference(level: number): void {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(level))
  } catch {
    // Ignore unavailable storage so zoom changes stay in-memory.
  }
}

export function clampZoom(level: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level)) * 100) / 100
}

export function zoomIn(current: number): number {
  return clampZoom(Math.round((current + ZOOM_STEP) * 10) / 10)
}

export function zoomOut(current: number): number {
  return clampZoom(Math.round((current - ZOOM_STEP) * 10) / 10)
}

export function zoomReset(): number {
  return ZOOM_DEFAULT
}

export { ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT }
