import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildMinimapSamples,
  getLineNumberFromMinimapOffset,
  getMinimapViewportStyle,
  Minimap,
} from './Minimap'

function createCanvasContext() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
}

describe('minimap helpers', () => {
  it('maps vertical offsets to 1-based document lines', () => {
    expect(getLineNumberFromMinimapOffset(0, 200, 1000)).toBe(1)
    expect(getLineNumberFromMinimapOffset(100, 200, 1000)).toBe(501)
    expect(getLineNumberFromMinimapOffset(199, 200, 1000)).toBe(996)
  })

  it('derives a proportional viewport box from scroll metrics', () => {
    expect(
      getMinimapViewportStyle({
        scrollTop: 400,
        scrollHeight: 1000,
        clientHeight: 200,
      }),
    ).toEqual({
      top: '40%',
      height: '20%',
    })
  })

  it('rasterises headings, lists, and empty lines into minimap samples', () => {
    expect(
      buildMinimapSamples(['# Heading', '  - list item', '', '```ts'], 56),
    ).toEqual([
      expect.objectContaining({ alpha: 0.96 }),
      expect.objectContaining({ alpha: 0.72 }),
      null,
      expect.objectContaining({ alpha: 0.5 }),
    ])
  })
})

describe('Minimap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws the minimap canvas and navigates based on click position', () => {
    const context = createCanvasContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const onNavigate = vi.fn()
    const content = Array.from({ length: 1000 }, (_, index) => `Line ${index + 1}`).join('\n')
    const { container } = render(
      <Minimap
        content={content}
        scrollMetrics={{
          scrollTop: 400,
          scrollHeight: 1000,
          clientHeight: 200,
        }}
        onNavigate={onNavigate}
      />,
    )

    expect(context.clearRect).toHaveBeenCalled()
    expect(context.fillRect).toHaveBeenCalled()

    const track = screen.getByRole('button', { name: 'Document minimap' })
    Object.defineProperty(track, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 56,
        height: 200,
        top: 0,
        left: 0,
        right: 56,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })

    fireEvent.click(track, { clientY: 100 })

    expect(onNavigate).toHaveBeenCalledWith(501)
    expect(container.querySelector('.mf-minimap-viewport')).toHaveStyle('top: 40%; height: 20%;')
  })
})
