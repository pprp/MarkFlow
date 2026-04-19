import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterCommandPaletteActions,
  registerCommandPaletteActions,
  type CommandPaletteAction,
  type RegisteredCommandPaletteAction,
} from './commandPaletteRegistry'
import { OverlayScreen } from './OverlayScreen'
import './CommandPalette.css'

interface CommandPaletteProps {
  isOpen: boolean
  actions: readonly CommandPaletteAction[]
  onClose: () => void
  onSelect: (action: RegisteredCommandPaletteAction) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  actions,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const registeredActions = useMemo(() => registerCommandPaletteActions(actions), [actions])
  const filteredActions = useMemo(
    () => filterCommandPaletteActions(registeredActions, query),
    [query, registeredActions],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setQuery('')
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen || !listRef.current) {
      return
    }

    const selectedItem = listRef.current.children[selectedIndex] as HTMLElement | undefined
    if (selectedItem && typeof selectedItem.scrollIntoView === 'function') {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, selectedIndex])

  if (!isOpen) {
    return null
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (filteredActions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => Math.min(current + 1, filteredActions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selectedAction = filteredActions[selectedIndex]
      if (selectedAction) {
        onSelect(selectedAction)
      }
    }
  }

  return (
    <OverlayScreen
      title="Command palette"
      eyebrow="Control center"
      description="Search commands, formats, and workspace actions."
      cardClassName="mf-command-palette-card"
      bodyClassName="mf-command-palette-body"
      footer={
        <div className="mf-command-palette-footer" aria-hidden="true">
          <span className="mf-command-palette-footer-item">
            <span className="mf-command-palette-kbd">↑↓</span>
            <span>navigate</span>
          </span>
          <span className="mf-command-palette-footer-item">
            <span className="mf-command-palette-kbd">↵</span>
            <span>run</span>
          </span>
          <span className="mf-command-palette-footer-item">
            <span className="mf-command-palette-kbd">⌘K</span>
            <span>close</span>
          </span>
        </div>
      }
      onBackdropMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="mf-command-palette-input-shell">
        <span className="mf-command-palette-search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6.25" cy="6.25" r="3.75" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.2 9.2L11.9 11.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          className="mf-command-palette-input"
          placeholder="Search commands..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="mf-command-palette-kbd">Esc</span>
      </div>
      <ul className="mf-command-palette-list" ref={listRef}>
        {filteredActions.length === 0 ? (
          <li className="mf-command-palette-empty">No matching commands</li>
        ) : (
          filteredActions.map((action, index) => (
            <li key={action.id} className="mf-command-palette-row">
              <button
                type="button"
                className={`mf-command-palette-item${index === selectedIndex ? ' is-selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onSelect(action)}
              >
                <div className="mf-command-palette-item-topline">
                  <span className="mf-command-palette-item-label">{action.label}</span>
                  {action.shortcut ? (
                    <span className="mf-command-palette-item-shortcut">{action.shortcut}</span>
                  ) : null}
                </div>
                <div className="mf-command-palette-item-meta">
                  <span className="mf-command-palette-item-category">{action.category}</span>
                  {action.description ? (
                    <span className="mf-command-palette-item-description">{action.description}</span>
                  ) : null}
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </OverlayScreen>
  )
}
