import * as fs from 'fs'
import * as path from 'path'
import { app, dialog } from 'electron'

const CLI_LINK_PATH = '/usr/local/bin/markflow'

function getCliSourcePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'cli', 'markflow')
  }
  return path.join(__dirname, '..', '..', '..', 'build', 'cli', 'markflow')
}

export async function installCliTool(): Promise<void> {
  const source = getCliSourcePath()

  try {
    fs.mkdirSync('/usr/local/bin', { recursive: true })
  } catch {
    // already exists or no permission — proceed and let symlink fail with a clear error
  }

  try {
    // Remove stale link/file if present
    try { fs.unlinkSync(CLI_LINK_PATH) } catch { /* ignore */ }
    fs.symlinkSync(source, CLI_LINK_PATH)
    await dialog.showMessageBox({
      type: 'info',
      title: "CLI Tool Installed",
      message: "Shell command 'markflow' installed.",
      detail: "You can now run 'markflow file.md' or 'markflow .' from any terminal.",
      buttons: ['OK'],
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    await dialog.showMessageBox({
      type: 'error',
      title: "Installation Failed",
      message: "Could not write to /usr/local/bin.",
      detail: `${detail}\n\nTo install manually, run:\n\nsudo ln -sf "${source}" ${CLI_LINK_PATH}`,
      buttons: ['OK'],
    })
  }
}

export function isCliToolInstalled(): boolean {
  try {
    return fs.readlinkSync(CLI_LINK_PATH) === getCliSourcePath()
  } catch {
    return false
  }
}
