import React, { useState, useEffect, useRef } from 'react'
import type { MarkFlowQuickOpenItem } from '@markflow/shared'
import './QuickOpen.css'

interface QuickOpenProps {
  isOpen: boolean
  items: MarkFlowQuickOpenItem[]
  onClose: () => void
  onSelect: (item: MarkFlowQuickOpenItem) => void
}

function fuzzyMatch(str: string, pattern: string): boolean {
  let patternIdx = 0
  const strLower = str.toLowerCase()
  const patternLower = pattern.toLowerCase()

  for (let i = 0; i < strLower.length && patternIdx < patternLower.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      patternIdx++
    }
  }

  return patternIdx === patternLower.length
}

export const QuickOpen: React.FC<QuickOpenProps> = ({ isOpen, items, onClose, onSelect }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  const filteredItems = items.filter(
    (item) => !query || fuzzyMatch(item.label, query) || fuzzyMatch(item.filePath, query)
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedEl && selectedEl.scrollIntoView) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        onSelect(filteredItems[selectedIndex])
      }
    }
  }

  return (
    <div className="mf-quick-open-overlay" onKeyDown={handleKeyDown}>
      <div className="mf-quick-open-input-container">
        <input
          ref={inputRef}
          type="text"
          className="mf-quick-open-input"
          placeholder="Search files or folders..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(onClose, 150)}
        />
      </div>
      <ul className="mf-quick-open-list" ref={listRef}>
        {filteredItems.length === 0 ? (
          <li className="mf-quick-open-empty">No files found</li>
        ) : (
          filteredItems.map((item, index) => (
            <li
              key={item.id}
              className={`mf-quick-open-item ${index === selectedIndex ? 'is-selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="mf-quick-open-item-label">
                {item.label}
                {item.kind === 'folder' && <span className="mf-quick-open-item-recent-badge">Folder</span>}
                {item.isPinned && <span className="mf-quick-open-item-recent-badge">Pinned</span>}
                {item.isRecent && <span className="mf-quick-open-item-recent-badge">Recent</span>}
              </div>
              {item.description && (
                <div className="mf-quick-open-item-desc" title={item.description}>
                  &hellip;{item.description.slice(-40)}
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
