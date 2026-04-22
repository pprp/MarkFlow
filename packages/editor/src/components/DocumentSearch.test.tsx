import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentSearch } from './DocumentSearch'

const noop = vi.fn()

function renderDocumentSearch(matchCount: number | null, query = 'flow') {
  return render(
    <DocumentSearch
      isOpen
      query={query}
      matchCount={matchCount}
      onChange={noop}
      onClose={noop}
      onNext={noop}
      onPrevious={noop}
    />,
  )
}

describe('DocumentSearch', () => {
  it('renders singular and plural match counts', () => {
    const { rerender } = renderDocumentSearch(1)

    expect(screen.getByText('1 match')).toBeInTheDocument()

    rerender(
      <DocumentSearch
        isOpen
        query="flow"
        matchCount={2}
        onChange={noop}
        onClose={noop}
        onNext={noop}
        onPrevious={noop}
      />,
    )

    expect(screen.getByText('2 matches')).toBeInTheDocument()
  })

  it('shows a pending state instead of a false zero count', () => {
    renderDocumentSearch(null)

    expect(screen.getByText('Searching...')).toBeInTheDocument()
    expect(screen.queryByText('0 matches')).not.toBeInTheDocument()
  })
})
