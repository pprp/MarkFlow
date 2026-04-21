import '@testing-library/jest-dom/vitest'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = TestResizeObserver as typeof ResizeObserver
}

const emptyDOMRectList = {
  item: () => null,
  length: 0,
  *[Symbol.iterator]() {
    yield* []
  },
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0)
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => emptyDOMRectList as DOMRectList
}
