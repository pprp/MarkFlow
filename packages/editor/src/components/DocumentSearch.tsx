import { useEffect, useRef } from 'react'
import './DocumentSearch.css'

interface DocumentSearchProps {
  isOpen: boolean
  query: string
  matchCount: number | null
  focusTrigger?: number
  onChange: (value: string) => void
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

export function DocumentSearch({
  isOpen,
  query,
  matchCount,
  focusTrigger,
  onChange,
  onClose,
  onNext,
  onPrevious,
}: DocumentSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const input = inputRef.current
    if (!input) {
      return
    }

    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }, [isOpen, focusTrigger])

  if (!isOpen) {
    return null
  }

  const trimmedQuery = query.trim()
  const statusText =
    trimmedQuery.length === 0
      ? 'Type to search'
      : matchCount === null
        ? 'Searching...'
        : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`

  return (
    <form
      className="mf-document-search"
      role="search"
      aria-label="Document search"
      onSubmit={(event) => {
        event.preventDefault()
        onNext()
      }}
    >
      <label className="mf-document-search-field">
        <span className="mf-document-search-label">Search</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          aria-label="Search document"
          placeholder="Search document..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey) {
                onPrevious()
              } else {
                onNext()
              }
              event.currentTarget.focus()
            }
          }}
        />
      </label>
      <span className="mf-document-search-count" aria-live="polite">
        {statusText}
      </span>
      <div className="mf-document-search-actions">
        <button type="button" onClick={onPrevious} aria-label="Previous match" title="Previous match (Shift+Enter)">
          ↑
        </button>
        <button type="button" onClick={onNext} aria-label="Next match" title="Next match (Enter)">
          ↓
        </button>
        <button type="button" onClick={onClose} aria-label="Close document search" title="Close document search">
          ✕
        </button>
      </div>
    </form>
  )
}
