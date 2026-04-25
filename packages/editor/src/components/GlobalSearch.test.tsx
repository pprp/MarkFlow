import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlobalSearch } from './GlobalSearch'

const onClose = vi.fn()
const onSelectResult = vi.fn()

function renderGlobalSearch(folderPath: string | null = null) {
  return render(
    <GlobalSearch
      isOpen
      folderPath={folderPath}
      onClose={onClose}
      onSelectResult={onSelectResult}
    />,
  )
}

function installSearchFilesMock(results: Array<{
  filePath: string
  lineNumber: number
  lineText: string
  matchStart: number
  matchEnd: number
}>) {
  Object.defineProperty(window, 'markflow', {
    configurable: true,
    writable: true,
    value: {
      searchFiles: vi.fn(async () => results),
    },
  })
}

describe('GlobalSearch', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'markflow')
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows an open-folder explanation when no folder is open and the query is empty', () => {
    renderGlobalSearch(null)

    expect(screen.getByText('Open a folder to search across files')).toBeInTheDocument()
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()
  })

  it('keeps the open-folder explanation visible when a query exists but folderPath becomes null', () => {
    vi.useFakeTimers()

    const { rerender } = renderGlobalSearch('/docs')

    act(() => {
      vi.advanceTimersByTime(10)
    })

    fireEvent.change(screen.getByLabelText('Search query'), { target: { value: 'flow' } })

    rerender(
      <GlobalSearch
        isOpen
        folderPath={null}
        onClose={onClose}
        onSelectResult={onSelectResult}
      />,
    )

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.getByText('Open a folder to search across files')).toBeInTheDocument()
    expect(screen.queryByText('No results found')).not.toBeInTheDocument()
  })

  it('shows normal no-results messaging when a folder is open', () => {
    vi.useFakeTimers()

    renderGlobalSearch('/docs')

    act(() => {
      vi.advanceTimersByTime(10)
    })

    fireEvent.change(screen.getByLabelText('Search query'), { target: { value: 'flow' } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByText('Open a folder to search across files')).not.toBeInTheDocument()
  })

  it('hides stale search results when folderPath drops to null after matches were returned', async () => {
    vi.useFakeTimers()
    installSearchFilesMock([
      {
        filePath: '/docs/alpha.md',
        lineNumber: 3,
        lineText: 'flow state',
        matchStart: 0,
        matchEnd: 4,
      },
    ])

    const { rerender } = renderGlobalSearch('/docs')

    act(() => {
      vi.advanceTimersByTime(10)
    })

    fireEvent.change(screen.getByLabelText('Search query'), { target: { value: 'flow' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(screen.getByText('alpha.md')).toBeInTheDocument()
    expect(screen.getByText('1 result in 1 file')).toBeInTheDocument()

    rerender(
      <GlobalSearch
        isOpen
        folderPath={null}
        onClose={onClose}
        onSelectResult={onSelectResult}
      />,
    )

    expect(screen.getByText('Open a folder to search across files')).toBeInTheDocument()
    expect(screen.queryByText('alpha.md')).not.toBeInTheDocument()
    expect(screen.queryByText('1 result in 1 file')).not.toBeInTheDocument()
  })
})
