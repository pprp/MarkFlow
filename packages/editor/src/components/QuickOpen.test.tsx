import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickOpen } from './QuickOpen'

describe('QuickOpen', () => {
  it('renders the shared editorial header copy when open', () => {
    render(
      <QuickOpen
        isOpen
        items={[
          {
            id: '/docs/alpha.md',
            label: 'alpha.md',
            description: '/docs',
            filePath: '/docs/alpha.md',
            kind: 'file',
            isRecent: false,
            isPinned: false,
          },
        ]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Open quickly')).toBeInTheDocument()
    expect(screen.getByText('Jump between nearby and recent documents.')).toBeInTheDocument()
  })
})
