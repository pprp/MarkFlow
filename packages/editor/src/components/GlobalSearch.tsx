import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { SearchResult } from '@markflow/shared'
import './GlobalSearch.css'

interface GlobalSearchProps {
  isOpen: boolean
  folderPath: string | null
  onClose: () => void
  onSelectResult: (result: SearchResult) => void
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath
}

function groupResultsByFile(results: SearchResult[]): Map<string, SearchResult[]> {
  const groups = new Map<string, SearchResult[]>()
  for (const result of results) {
    const group = groups.get(result.filePath)
    if (group) {
      group.push(result)
    } else {
      groups.set(result.filePath, [result])
    }
  }
  return groups
}

function HighlightedLine({ lineText, matchStart, matchEnd }: { lineText: string; matchStart: number; matchEnd: number }) {
  const before = lineText.slice(0, matchStart)
  const match = lineText.slice(matchStart, matchEnd)
  const after = lineText.slice(matchEnd)
  const maxLen = 80
  let displayBefore = before
  let displayAfter = after

  if (before.length + match.length + after.length > maxLen) {
    const contextBefore = Math.min(20, before.length)
    displayBefore = before.length > contextBefore ? '…' + before.slice(-contextBefore) : before
    const remaining = maxLen - displayBefore.length - match.length
    displayAfter = after.length > remaining ? after.slice(0, remaining) + '…' : after
  }

  return (
    <span className="mf-global-search-line-text">
      {displayBefore}
      <mark className="mf-global-search-match">{match}</mark>
      {displayAfter}
    </span>
  )
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  folderPath,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !folderPath || !window.markflow) {
        setResults([])
        return
      }
      setIsSearching(true)
      try {
        const found = await window.markflow.searchFiles(folderPath, q)
        setResults(found)
        setSelectedIndex(0)
      } finally {
        setIsSearching(false)
      }
    },
    [folderPath],
  )

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query, runSearch])

  if (!isOpen) return null

  const flatResults = results
  const grouped = groupResultsByFile(flatResults)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatResults[selectedIndex]) {
        onSelectResult(flatResults[selectedIndex])
      }
    }
  }

  let resultIndex = 0

  return (
    <div className="mf-global-search-overlay" onKeyDown={handleKeyDown} role="dialog" aria-label="Global search">
      <div className="mf-global-search-input-container">
        <input
          ref={inputRef}
          type="text"
          className="mf-global-search-input"
          placeholder={folderPath ? 'Search in files…' : 'Open a folder first to search'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(onClose, 200)}
          disabled={!folderPath}
          aria-label="Search query"
        />
      </div>

      <div className="mf-global-search-results">
        {!query.trim() && (
          <div className="mf-global-search-empty">
            {folderPath ? 'Type to search across all files' : 'No folder open'}
          </div>
        )}
        {query.trim() && isSearching && (
          <div className="mf-global-search-empty">Searching…</div>
        )}
        {query.trim() && !isSearching && results.length === 0 && (
          <div className="mf-global-search-empty">No results found</div>
        )}
        {Array.from(grouped.entries()).map(([filePath, fileResults]) => (
          <div key={filePath} className="mf-global-search-file-group">
            <div className="mf-global-search-file-header" title={filePath}>
              {basename(filePath)}
            </div>
            {fileResults.map((result) => {
              const currentIndex = resultIndex++
              const isSelected = currentIndex === selectedIndex
              return (
                <div
                  key={`${result.filePath}:${result.lineNumber}:${result.matchStart}`}
                  className={`mf-global-search-result-item${isSelected ? ' is-selected' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectResult(result)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Line ${result.lineNumber}: ${result.lineText}`}
                >
                  <span className="mf-global-search-line-number">Line {result.lineNumber}</span>
                  <HighlightedLine
                    lineText={result.lineText}
                    matchStart={result.matchStart}
                    matchEnd={result.matchEnd}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="mf-global-search-status">
          {results.length} result{results.length !== 1 ? 's' : ''} in {grouped.size} file{grouped.size !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
