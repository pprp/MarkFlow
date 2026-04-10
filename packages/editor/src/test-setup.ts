import '@testing-library/jest-dom/vitest'

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
