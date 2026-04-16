import { useCallback, useEffect, useMemo, useRef } from 'react'

const MINIMAP_FALLBACK_WIDTH = 56
const MINIMAP_INSET = 4
const MINIMAP_CONTENT_CAP = 120
const EMPTY_VIEWPORT_STYLE = {
  top: '0%',
  height: '100%',
}

export interface MinimapScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export interface MinimapProps {
  content: string
  scrollMetrics: MinimapScrollMetrics | null
  onNavigate: (lineNumber: number) => void
}

interface MinimapSample {
  alpha: number
  start: number
  width: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getIndentWeight(line: string) {
  const leadingWhitespace = line.length - line.trimStart().length
  return Math.min(leadingWhitespace, 18)
}

export function getMinimapLineCount(content: string) {
  return content.length === 0 ? 1 : content.split('\n').length
}

export function getLineNumberFromMinimapOffset(offsetY: number, viewportHeight: number, lineCount: number) {
  if (lineCount <= 1 || viewportHeight <= 0) {
    return 1
  }

  const ratio = clamp(offsetY / viewportHeight, 0, 0.999999)
  return clamp(Math.floor(ratio * lineCount) + 1, 1, lineCount)
}

export function getMinimapViewportStyle(scrollMetrics: MinimapScrollMetrics | null) {
  if (
    !scrollMetrics ||
    scrollMetrics.scrollHeight <= 0 ||
    scrollMetrics.clientHeight <= 0 ||
    scrollMetrics.scrollHeight <= scrollMetrics.clientHeight
  ) {
    return EMPTY_VIEWPORT_STYLE
  }

  const heightRatio = clamp(scrollMetrics.clientHeight / scrollMetrics.scrollHeight, 0, 1)
  const travel = scrollMetrics.scrollHeight - scrollMetrics.clientHeight
  const topRatio = clamp(scrollMetrics.scrollTop / travel, 0, 1)

  return {
    top: `${topRatio * (1 - heightRatio) * 100}%`,
    height: `${heightRatio * 100}%`,
  }
}

export function buildMinimapSamples(lines: readonly string[], pixelWidth: number) {
  return lines.map<MinimapSample | null>((line) => {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      return null
    }

    const isHeading = trimmed.startsWith('#')
    const isCodeFence = trimmed.startsWith('```') || trimmed.startsWith('~~~')
    const isQuote = trimmed.startsWith('>')
    const isList = /^([-*+]|\d+\.)\s+/.test(trimmed)
    const prefixWeight =
      getIndentWeight(line) +
      (isQuote ? 3 : 0) +
      (isList ? 4 : 0) +
      (isHeading ? 2 : 0)
    const start = clamp(
      MINIMAP_INSET + Math.round(prefixWeight * 0.55),
      MINIMAP_INSET,
      pixelWidth - 2,
    )
    const availableWidth = Math.max(2, pixelWidth - start - MINIMAP_INSET)
    const width = Math.max(
      2,
      Math.round((Math.min(trimmed.length, MINIMAP_CONTENT_CAP) / MINIMAP_CONTENT_CAP) * availableWidth),
    )

    return {
      start,
      width: Math.min(width, availableWidth),
      alpha: isHeading ? 0.96 : isCodeFence ? 0.5 : 0.72,
    }
  })
}

export function Minimap({ content, scrollMetrics, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lineCount = useMemo(() => getMinimapLineCount(content), [content])
  const lines = useMemo(() => (content.length === 0 ? [''] : content.split('\n')), [content])
  const viewportStyle = useMemo(() => getMinimapViewportStyle(scrollMetrics), [scrollMetrics])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const pixelWidth = Math.max(canvas.parentElement?.clientWidth ?? 0, MINIMAP_FALLBACK_WIDTH)
    canvas.width = pixelWidth
    canvas.height = lineCount

    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const root = canvas.parentElement ?? canvas
    const styles = getComputedStyle(root)
    const ink = styles.getPropertyValue('--mf-fg-muted').trim() || 'rgba(60, 67, 74, 0.72)'
    const accent = styles.getPropertyValue('--mf-accent').trim() || '#2563eb'

    context.clearRect(0, 0, pixelWidth, lineCount)

    buildMinimapSamples(lines, pixelWidth).forEach((sample, index) => {
      if (!sample) {
        return
      }

      context.globalAlpha = sample.alpha
      context.fillStyle = ink
      context.fillRect(sample.start, index, sample.width, 1)

      if (sample.alpha > 0.9) {
        context.globalAlpha = 0.95
        context.fillStyle = accent
        context.fillRect(MINIMAP_INSET - 1, index, 2, 1)
      }
    })

    context.globalAlpha = 1
  }, [lineCount, lines])

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const lineNumber = getLineNumberFromMinimapOffset(
      event.clientY - rect.top,
      rect.height,
      lineCount,
    )
    onNavigate(lineNumber)
  }, [lineCount, onNavigate])

  return (
    <aside className="mf-minimap-panel">
      <div
        className="mf-minimap-track"
        aria-label="Document minimap"
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        <canvas ref={canvasRef} className="mf-minimap-canvas" aria-hidden="true" />
        <div className="mf-minimap-viewport" aria-hidden="true" style={viewportStyle} />
      </div>
    </aside>
  )
}
