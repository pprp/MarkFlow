import type { MarkFlowQuickOpenItem } from '@markflow/shared'
import type { OutlineHeading } from '../editor/outline'
import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import type { OutlineDisplayMode } from '../outlinePanelPreferences'
import { buildOutlineTree, filterOutlineHeadings } from '../outlinePanelState'
import './VaultSidebar.css'

export interface VaultSidebarProps {
  activeFile: string | null
  activeOutlineAnchor?: string | null
  files: string[]
  folderPath: string | null
  onFileDelete: (filePath: string) => void
  onFileOpen: (filePath: string) => void
  onFileRename: (oldPath: string, newName: string) => void
  onOpenFolder: () => void
  onOutlineSelect?: (position: number) => void
  onRecentSelect?: (item: MarkFlowQuickOpenItem) => void
  onOutlineFilterChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onOutlineDisplayModeChange?: (mode: OutlineDisplayMode) => void
  onToggleOutlineAnchorCollapsed?: (anchor: string) => void
  collapsedOutlineAnchors?: ReadonlySet<string>
  outlineCollapsed?: boolean
  outlineDisplayMode?: OutlineDisplayMode
  outlineFilterQuery?: string
  outlineItems?: readonly OutlineHeading[]
  recentItems?: readonly MarkFlowQuickOpenItem[]
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2.5 1.5h5.5L11 4v7a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <path d="M7.5 1.5V4H11" stroke="currentColor" strokeWidth="1" fill="none" strokeLinejoin="round" />
      <path d="M4 6h5M4 7.5h5M4 9h3" stroke="currentColor" strokeWidth="0.85" strokeLinecap="round" />
    </svg>
  )
}

function WorkspaceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.5 5.5a1 1 0 0 1 1-1h2.6l.9 1H12a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H2.5a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VaultSidebar({
  activeFile,
  activeOutlineAnchor = null,
  files,
  folderPath,
  onFileDelete,
  onFileOpen,
  onFileRename,
  onOpenFolder,
  onOutlineSelect,
  onRecentSelect,
  onOutlineFilterChange,
  onOutlineDisplayModeChange,
  onToggleOutlineAnchorCollapsed,
  collapsedOutlineAnchors = new Set<string>(),
  outlineCollapsed = false,
  outlineDisplayMode = 'flat',
  outlineFilterQuery = '',
  outlineItems = [],
  recentItems = [],
}: VaultSidebarProps) {
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [localOutlineFilterQuery, setLocalOutlineFilterQuery] = useState(outlineFilterQuery)
  const [localOutlineDisplayMode, setLocalOutlineDisplayMode] =
    useState<OutlineDisplayMode>(outlineDisplayMode)
  const [localCollapsedOutlineAnchors, setLocalCollapsedOutlineAnchors] = useState<Set<string>>(
    () => new Set(),
  )
  const renameInputRef = useRef<HTMLInputElement>(null)

  function startRename(filePath: string) {
    setRenamingFile(filePath)
    setRenameValue(basename(filePath))
    requestAnimationFrame(() => {
      renameInputRef.current?.select()
    })
  }

  function commitRename() {
    if (renamingFile && renameValue.trim()) {
      onFileRename(renamingFile, renameValue.trim())
    }
    setRenamingFile(null)
    setRenameValue('')
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') {
      setRenamingFile(null)
      setRenameValue('')
    }
  }

  const folderName = folderPath ? basename(folderPath) : 'MarkFlow'
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredFiles = useMemo(() => {
    if (!normalizedSearchQuery) {
      return files
    }

    return files.filter((filePath) => {
      const fileName = basename(filePath).toLowerCase()
      return fileName.includes(normalizedSearchQuery) || filePath.toLowerCase().includes(normalizedSearchQuery)
    })
  }, [files, normalizedSearchQuery])

  const visibleRecentItems = recentItems.slice(0, 6)
  const effectiveOutlineFilterQuery =
    onOutlineFilterChange == null ? localOutlineFilterQuery : outlineFilterQuery
  const effectiveCollapsedOutlineAnchors =
    onToggleOutlineAnchorCollapsed == null ? localCollapsedOutlineAnchors : collapsedOutlineAnchors
  const filteredOutlineItems = useMemo(
    () => filterOutlineHeadings(outlineItems, effectiveOutlineFilterQuery),
    [effectiveOutlineFilterQuery, outlineItems],
  )
  const effectiveOutlineDisplayMode: OutlineDisplayMode =
    effectiveOutlineFilterQuery.trim().length > 0
      ? 'flat'
      : onOutlineDisplayModeChange == null
        ? localOutlineDisplayMode
        : outlineDisplayMode
  const outlineTree = useMemo(
    () => buildOutlineTree(filteredOutlineItems),
    [filteredOutlineItems],
  )
  const handleOutlineFilterInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onOutlineFilterChange) {
      onOutlineFilterChange(event)
      return
    }

    setLocalOutlineFilterQuery(event.target.value)
  }
  const handleOutlineDisplayModeChange = (nextMode: OutlineDisplayMode) => {
    if (onOutlineDisplayModeChange) {
      onOutlineDisplayModeChange(nextMode)
      return
    }

    setLocalOutlineDisplayMode(nextMode)
    setLocalCollapsedOutlineAnchors(new Set())
  }
  const handleToggleOutlineAnchorCollapsed = (anchor: string) => {
    if (onToggleOutlineAnchorCollapsed) {
      onToggleOutlineAnchorCollapsed(anchor)
      return
    }

    setLocalCollapsedOutlineAnchors((current) => {
      const next = new Set(current)
      if (next.has(anchor)) {
        next.delete(anchor)
      } else {
        next.add(anchor)
      }
      return next
    })
  }
  const renderOutlineTree = (nodes: ReturnType<typeof buildOutlineTree>) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0
      const isCollapsed = effectiveCollapsedOutlineAnchors.has(node.heading.anchor)
      const isActive = node.heading.anchor === activeOutlineAnchor

      return (
        <div
          key={`${node.heading.anchor}:${node.heading.from}`}
          className="mf-vault-outline-node"
        >
          <div className="mf-vault-outline-row">
            {hasChildren ? (
              <button
                type="button"
                className="mf-outline-tree-toggle"
                onClick={() => handleToggleOutlineAnchorCollapsed(node.heading.anchor)}
                aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.heading.text}`}
                aria-expanded={!isCollapsed}
              >
                <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
              </button>
            ) : (
              <span className="mf-outline-tree-spacer" aria-hidden="true" />
            )}
            <button
              type="button"
              className={`mf-vault-nav-item mf-vault-outline-item${isActive ? ' mf-vault-nav-item-active' : ''}`}
              aria-label={node.heading.text}
              aria-current={isActive ? 'true' : undefined}
              style={{ paddingLeft: `${10 + (node.heading.level - 1) * 12}px` }}
              onClick={() => onOutlineSelect?.(node.heading.from)}
            >
              <span className="mf-vault-nav-item-copy">{node.heading.text}</span>
            </button>
          </div>
          {!isCollapsed && node.children.length > 0 ? renderOutlineTree(node.children) : null}
        </div>
      )
    })

  return (
    <div className="mf-vault-sidebar">
      {/* Workspace header */}
      <div className="mf-vault-header">
        <div className="mf-vault-header-workspace">
          <span className="mf-vault-header-icon">
            <WorkspaceIcon />
          </span>
          <span className="mf-vault-header-name" title={folderPath ?? undefined}>
            {folderName}
          </span>
          {folderPath ? (
            <span className="mf-vault-header-count">{files.length}</span>
          ) : null}
        </div>
        <button
          className="mf-vault-action-btn"
          onClick={onOpenFolder}
          title="Open folder"
          aria-label="Open folder"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1.5 4.5a1 1 0 0 1 1-1h2.4l1 1.1h5.6a1 1 0 0 1 1 1v4.9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path
              d="M7 6.2v3.6M5.2 8h3.6"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Search — always visible */}
      <label className="mf-vault-search" aria-label="Search files">
        <span className="mf-vault-search-icon" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="text"
          className="mf-vault-search-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search files…"
        />
      </label>

      <div className="mf-vault-scroll">
        {!folderPath ? (
          <section className="mf-vault-hero">
            <span className="mf-vault-hero-eyebrow">Editorial bundle</span>
            <h2 className="mf-vault-hero-title">MarkFlow Bundle</h2>
            <p className="mf-vault-hero-description">
              Open a folder to turn MarkFlow into a warmer writing workspace with recent context and live structure.
            </p>
          </section>
        ) : null}

        {/* Files section — primary content */}
        <section className="mf-vault-section mf-vault-section-files">
          <div className="mf-vault-section-header">
            <span>Files</span>
            {folderPath ? <span className="mf-vault-section-meta">{filteredFiles.length}</span> : null}
          </div>

          {!folderPath ? (
            <button className="mf-vault-open-btn" onClick={onOpenFolder}>
              Open folder
            </button>
          ) : files.length === 0 ? (
            <div className="mf-vault-empty">No markdown files found</div>
          ) : filteredFiles.length === 0 ? (
            <div className="mf-vault-empty">No matching files</div>
          ) : (
            <div className="mf-vault-files">
              {filteredFiles.map((filePath) => {
                const name = basename(filePath)
                const isActive = filePath === activeFile
                const isRenaming = filePath === renamingFile

                return (
                  <div
                    key={filePath}
                    className={`mf-vault-file-item${isActive ? ' mf-vault-file-active' : ''}`}
                    onClick={() => !isRenaming && onFileOpen(filePath)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && !isRenaming && onFileOpen(filePath)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {!isRenaming ? (
                      <span className="mf-vault-file-icon">
                        <FileIcon />
                      </span>
                    ) : null}
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="mf-vault-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={commitRename}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Rename file"
                      />
                    ) : (
                      <span className="mf-vault-file-name" title={filePath}>
                        {name}
                      </span>
                    )}
                    {!isRenaming ? (
                      <div className="mf-vault-file-actions">
                        <button
                          className="mf-vault-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            startRename(filePath)
                          }}
                          title="Rename"
                          aria-label={`Rename ${name}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path
                              d="M8.7 1.6a1 1 0 0 1 1.4 0l.3.3a1 1 0 0 1 0 1.4L4.6 9.1l-2 .6.6-2z"
                              stroke="currentColor"
                              strokeWidth="1.1"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          className="mf-vault-action-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (window.confirm(`Delete "${name}"?`)) {
                              onFileDelete(filePath)
                            }
                          }}
                          title="Delete"
                          aria-label={`Delete ${name}`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                            <path
                              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Recent section */}
        {visibleRecentItems.length > 0 ? (
          <section className="mf-vault-section">
            <div className="mf-vault-section-header">
              <span>Recent</span>
            </div>
            <div className="mf-vault-nav-list">
              {visibleRecentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mf-vault-nav-item"
                  aria-label={item.label}
                  onClick={() => onRecentSelect?.(item)}
                >
                  <span className="mf-vault-nav-item-topline">
                    <span className="mf-vault-nav-item-copy">{item.label}</span>
                    {item.kind === 'folder' || item.isPinned ? (
                      <span className="mf-vault-nav-badges">
                        {item.kind === 'folder' ? <span className="mf-vault-nav-badge">Folder</span> : null}
                        {item.isPinned ? <span className="mf-vault-nav-badge">Pinned</span> : null}
                      </span>
                    ) : null}
                  </span>
                  {item.description ? <span className="mf-vault-nav-item-meta">{item.description}</span> : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Outline section */}
        {outlineItems.length > 0 ? (
          <section className="mf-vault-section">
            <div className="mf-vault-section-header">
              <span>Outline</span>
              <div className="mf-outline-mode-toggle" role="group" aria-label="Outline display mode">
                <button
                  type="button"
                  className={`mf-outline-mode-button${effectiveOutlineDisplayMode === 'flat' ? ' mf-outline-mode-button-active' : ''}`}
                  onClick={() => handleOutlineDisplayModeChange('flat')}
                  aria-label="Flat outline mode"
                  aria-pressed={effectiveOutlineDisplayMode === 'flat'}
                >
                  Flat
                </button>
                <button
                  type="button"
                  className={`mf-outline-mode-button${effectiveOutlineDisplayMode === 'collapsible' ? ' mf-outline-mode-button-active' : ''}`}
                  onClick={() => handleOutlineDisplayModeChange('collapsible')}
                  aria-label="Collapsible outline mode"
                  aria-pressed={effectiveOutlineDisplayMode === 'collapsible'}
                >
                  Collapsible
                </button>
              </div>
            </div>
            {!outlineCollapsed ? (
              <>
                <label className="mf-outline-search">
                  <span className="mf-outline-search-icon" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <circle cx="5.5" cy="5.5" r="3.5" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="mf-outline-search-input"
                    value={effectiveOutlineFilterQuery}
                    onChange={handleOutlineFilterInputChange}
                    placeholder="Filter headings…"
                    aria-label="Filter outline headings"
                  />
                </label>
                <nav className="mf-vault-outline-list" aria-label="Outline">
                  {filteredOutlineItems.length === 0 ? (
                    <div className="mf-outline-empty">No matching headings</div>
                  ) : effectiveOutlineDisplayMode === 'collapsible' ? (
                    renderOutlineTree(outlineTree)
                  ) : (
                    filteredOutlineItems.map((heading) => {
                      const isActive = heading.anchor === activeOutlineAnchor

                      return (
                        <button
                          key={`${heading.anchor}:${heading.from}`}
                          type="button"
                          className={`mf-vault-nav-item mf-vault-outline-item${isActive ? ' mf-vault-nav-item-active' : ''}`}
                          aria-label={heading.text}
                          aria-current={isActive ? 'true' : undefined}
                          style={{ paddingLeft: `${10 + (heading.level - 1) * 12}px` }}
                          onClick={() => onOutlineSelect?.(heading.from)}
                        >
                          <span className="mf-vault-nav-item-copy">{heading.text}</span>
                        </button>
                      )
                    })
                  )}
                </nav>
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
