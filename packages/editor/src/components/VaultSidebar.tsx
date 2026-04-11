import { useState, useRef } from 'react'
import './VaultSidebar.css'

export interface VaultSidebarProps {
  folderPath: string | null
  files: string[]
  activeFile: string | null
  onFileOpen: (filePath: string) => void
  onFileRename: (oldPath: string, newName: string) => void
  onFileDelete: (filePath: string) => void
  onOpenFolder: () => void
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath
}

export function VaultSidebar({
  folderPath,
  files,
  activeFile,
  onFileOpen,
  onFileRename,
  onFileDelete,
  onOpenFolder,
}: VaultSidebarProps) {
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
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

  const folderName = folderPath ? basename(folderPath) : 'Files'

  return (
    <div className="mf-vault-sidebar">
      <div className="mf-vault-header">
        <span>{folderPath ? folderName : 'No Folder'}</span>
        <button
          className="mf-vault-action-btn"
          onClick={onOpenFolder}
          title="Open folder"
          aria-label="Open folder"
        >
          ...
        </button>
      </div>

      {!folderPath ? (
        <button className="mf-vault-open-btn" onClick={onOpenFolder}>
          Open Folder
        </button>
      ) : files.length === 0 ? (
        <div className="mf-vault-empty">No markdown files found</div>
      ) : (
        <div className="mf-vault-files">
          {files.map((filePath) => {
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
                {!isRenaming && (
                  <div className="mf-vault-file-actions">
                    <button
                      className="mf-vault-action-btn"
                      onClick={(e) => { e.stopPropagation(); startRename(filePath) }}
                      title="Rename"
                      aria-label={`Rename ${name}`}
                    >
                      ✎
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
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
