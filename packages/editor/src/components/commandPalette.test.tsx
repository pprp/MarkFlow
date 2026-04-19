import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import {
  filterCommandPaletteActions,
  registerCommandPaletteActions,
  type CommandPaletteAction,
  type RegisteredCommandPaletteAction,
} from './commandPaletteRegistry'

function createRepresentativeActions(executed: string[]) {
  const action = (
    id: string,
    label: string,
    category: string,
    options: Pick<CommandPaletteAction, 'description' | 'keywords' | 'shortcut'> = {},
  ): CommandPaletteAction => ({
    id,
    label,
    category,
    ...options,
    run: () => {
      executed.push(id)
      return true
    },
  })

  return [
    action('view.toggle-wysiwyg', 'Toggle WYSIWYG Mode', 'View', {
      keywords: ['preview', 'source'],
      shortcut: 'Mod+/',
    }),
    action('view.toggle-outline', 'Toggle Outline', 'View', {
      keywords: ['headings', 'sidebar'],
    }),
    action('export.html', 'Export HTML', 'Export', {
      keywords: ['save as html'],
    }),
    action('insert.table', 'Insert Table', 'Insert', {
      keywords: ['markdown table'],
    }),
    action('navigation.go-to-line', 'Go to Line', 'Navigation', {
      keywords: ['jump', 'line number'],
      shortcut: 'Mod+L',
    }),
  ]
}

describe('command palette helpers', () => {
  it('registers a representative action registry in declaration order', () => {
    const actions = registerCommandPaletteActions(createRepresentativeActions([]))

    expect(actions.map((action) => action.id)).toEqual([
      'view.toggle-wysiwyg',
      'view.toggle-outline',
      'export.html',
      'insert.table',
      'navigation.go-to-line',
    ])
    expect(actions.map((action) => action.registrationIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('ranks prefix and fuzzy matches by relevance', () => {
    const actions = registerCommandPaletteActions(createRepresentativeActions([]))

    expect(filterCommandPaletteActions(actions, 'toggle out').map((action) => action.id)).toEqual([
      'view.toggle-outline',
    ])
    expect(filterCommandPaletteActions(actions, 'exp h').map((action) => action.id)).toEqual([
      'export.html',
    ])
    expect(filterCommandPaletteActions(actions, 'gtl')[0]?.id).toBe('navigation.go-to-line')
  })
})

describe('CommandPalette', () => {
  it('dispatches the selected command from the filtered registry', async () => {
    const executed: string[] = []
    const onClose = vi.fn()

    render(
      <CommandPalette
        isOpen
        actions={createRepresentativeActions(executed)}
        onClose={onClose}
        onSelect={(action: RegisteredCommandPaletteAction) => {
          void action.run()
        }}
      />,
    )

    const input = await screen.findByPlaceholderText('Search commands...')
    fireEvent.change(input, { target: { value: 'insert table' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(executed).toEqual(['insert.table'])

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders the design-system keyboard helper row when open', () => {
    render(
      <CommandPalette
        isOpen
        actions={createRepresentativeActions([])}
        onClose={vi.fn()}
        onSelect={() => {}}
      />,
    )

    expect(screen.getByText('Command palette')).toBeInTheDocument()
    expect(screen.getByText('Search commands, formats, and workspace actions.')).toBeInTheDocument()
    expect(screen.getByText('Esc')).toBeInTheDocument()
    expect(screen.getByText('navigate')).toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.getByText('close')).toBeInTheDocument()
  })
})
