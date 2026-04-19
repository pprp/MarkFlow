import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VaultSidebar } from './VaultSidebar'

function renderSidebar() {
  const onFileOpen = vi.fn()
  const onFileRename = vi.fn()
  const onFileDelete = vi.fn()
  const onOpenFolder = vi.fn()
  const onRecentSelect = vi.fn()
  const onOutlineSelect = vi.fn()

  const view = render(
    <VaultSidebar
      folderPath="/Users/pprp/Notes"
      files={[
        '/Users/pprp/Notes/README.md',
        '/Users/pprp/Notes/notes.md',
        '/Users/pprp/Notes/Phase-2-spec.md',
      ]}
      activeFile="/Users/pprp/Notes/notes.md"
      onFileOpen={onFileOpen}
      onFileRename={onFileRename}
      onFileDelete={onFileDelete}
      onOpenFolder={onOpenFolder}
      recentItems={[
        {
          id: 'file:/recent/roadmap.md',
          label: 'roadmap.md',
          description: '/recent',
          filePath: '/recent/roadmap.md',
          kind: 'file',
          isRecent: true,
          isPinned: false,
        },
      ]}
      outlineItems={[
        {
          anchor: 'introduction',
          from: 0,
          level: 1,
          lineNumber: 1,
          text: 'Introduction',
        },
      ]}
      activeOutlineAnchor="introduction"
      onRecentSelect={onRecentSelect}
      onOutlineSelect={onOutlineSelect}
    />,
  )

  return {
    ...view,
    onFileOpen,
    onFileRename,
    onFileDelete,
    onOpenFolder,
    onRecentSelect,
    onOutlineSelect,
  }
}

describe('VaultSidebar', () => {
  it('filters the visible file list from the sidebar search field', () => {
    renderSidebar()

    const searchInput = screen.getByPlaceholderText('Search files…')
    fireEvent.change(searchInput, { target: { value: 'phase' } })

    expect(screen.getByText('Phase-2-spec.md')).toBeInTheDocument()
    expect(screen.queryByText('README.md')).not.toBeInTheDocument()
    expect(screen.queryByText('notes.md')).not.toBeInTheDocument()
  })

  it('shows an empty-state message when the sidebar filter matches nothing', () => {
    renderSidebar()

    const searchInput = screen.getByPlaceholderText('Search files…')
    fireEvent.change(searchInput, { target: { value: 'zzz' } })

    expect(screen.getByText('No matching files')).toBeInTheDocument()
  })

  it('renders recent and outline sections and dispatches their handlers', () => {
    const { onOutlineSelect, onRecentSelect } = renderSidebar()

    expect(screen.getByText('Recent', { selector: '.mf-vault-section-header span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'roadmap.md' })).toBeInTheDocument()
    expect(screen.getByText('Outline', { selector: '.mf-vault-section-header span' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Introduction' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'roadmap.md' }))
    fireEvent.click(screen.getByRole('button', { name: 'Introduction' }))

    expect(onRecentSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/recent/roadmap.md',
      }),
    )
    expect(onOutlineSelect).toHaveBeenCalledWith(0)
  })

  it('renders workspace name in header and avoids hero/badges when a folder is open', () => {
    const { container } = renderSidebar()

    expect(container.querySelector('.mf-vault-header-workspace')).toBeInTheDocument()
    expect(container.querySelector('.mf-vault-header-name')?.textContent).toBe('Notes')
    expect(container.querySelector('.mf-vault-header-count')?.textContent).toBe('3')
    expect(container.querySelector('.mf-vault-hero')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.mf-vault-nav-badge')).toHaveLength(0)
  })
})
