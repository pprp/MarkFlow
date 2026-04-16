import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterCommandPaletteActions,
  registerCommandPaletteActions,
  type CommandPaletteAction,
  type RegisteredCommandPaletteAction,
} from './commandPaletteRegistry'
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
    <div
      className="mf-command-palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="mf-command-palette-card" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="mf-command-palette-input-shell">
          <input
            ref={inputRef}
            type="text"
            className="mf-command-palette-input"
            placeholder="Search commands..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
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
      </div>
    </div>
  )
}
