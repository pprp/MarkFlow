import React, { useEffect, useRef, useState } from 'react'
import { OverlayScreen } from './OverlayScreen'
import './GoToLine.css'

interface GoToLineProps {
  isOpen: boolean
  currentLine: number
  totalLines: number
  onClose: () => void
  onSubmit: (lineNumber: number) => void
}

export const GoToLine: React.FC<GoToLineProps> = ({
  isOpen,
  currentLine,
  totalLines,
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setValue(String(currentLine))
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 10)
  }, [currentLine, isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      return
    }

    onSubmit(parsed)
  }

  return (
    <OverlayScreen
      title="Go to line"
      eyebrow="Navigation"
      description="Jump to a precise line without breaking flow."
      cardClassName="mf-go-to-line-card"
      bodyClassName="mf-go-to-line-body"
      onBackdropMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <form className="mf-go-to-line-form" onSubmit={handleSubmit}>
        <span className="mf-go-to-line-meta">
          Line {currentLine.toLocaleString()} of {totalLines.toLocaleString()}
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="mf-go-to-line-input"
          aria-label="Line number"
          placeholder={`1-${totalLines}`}
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />
        <p className="mf-go-to-line-hint">Press Enter to jump. Values outside the file clamp automatically.</p>
      </form>
    </OverlayScreen>
  )
}
