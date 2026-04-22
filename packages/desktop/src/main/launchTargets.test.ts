import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseLaunchArgumentsFromArgv, parseLaunchTargetsFromArgv } from './launchTargets'

const tempPaths: string[] = []

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { recursive: true, force: true })
  }
})

describe('parseLaunchTargetsFromArgv', () => {
  it('accepts markdown files and folders from argv while ignoring Electron flags', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-targets-'))
    tempPaths.push(tempDir)

    const markdownPath = path.join(tempDir, 'note.markdown')
    const vaultPath = path.join(tempDir, 'vault')
    fs.writeFileSync(markdownPath, '# Note', 'utf8')
    fs.mkdirSync(vaultPath)
    const normalizedMarkdownPath = fs.realpathSync(markdownPath)
    const normalizedVaultPath = fs.realpathSync(vaultPath)

    const targets = parseLaunchTargetsFromArgv([
      '--remote-debugging-port=9222',
      markdownPath,
      vaultPath,
    ])

    expect(targets).toEqual([
      { kind: 'file', path: normalizedMarkdownPath },
      { kind: 'folder', path: normalizedVaultPath },
    ])
  })

  it('normalizes relative markdown paths and ignores unsupported files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-targets-'))
    tempPaths.push(tempDir)

    const markdownPath = path.join(tempDir, 'draft.md')
    const imagePath = path.join(tempDir, 'diagram.png')
    fs.writeFileSync(markdownPath, '# Draft', 'utf8')
    fs.writeFileSync(imagePath, 'png', 'utf8')
    const normalizedTempDir = fs.realpathSync(tempDir)
    const normalizedMarkdownPath = fs.realpathSync(markdownPath)

    const previousCwd = process.cwd()
    process.chdir(tempDir)

    try {
      const targets = parseLaunchTargetsFromArgv(['.', 'draft.md', 'diagram.png'])

      expect(targets).toEqual([
        { kind: 'folder', path: normalizedTempDir },
        { kind: 'file', path: normalizedMarkdownPath },
      ])
    } finally {
      process.chdir(previousCwd)
    }
  })

  it('parses Typora-style startup override flags while preserving file and folder targets', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-launch-targets-'))
    tempPaths.push(tempDir)

    const markdownPath = path.join(tempDir, 'note.md')
    const vaultPath = path.join(tempDir, 'vault')
    fs.writeFileSync(markdownPath, '# Note', 'utf8')
    fs.mkdirSync(vaultPath)
    const normalizedMarkdownPath = fs.realpathSync(markdownPath)
    const normalizedVaultPath = fs.realpathSync(vaultPath)

    const launchArguments = parseLaunchArgumentsFromArgv([
      '--remote-debugging-port=9222',
      '--new',
      markdownPath,
      '--reopen-file',
      vaultPath,
    ])

    expect(launchArguments).toEqual({
      startupBehaviorOverride: 'restore-last-file-and-folder',
      targets: [
        { kind: 'file', path: normalizedMarkdownPath },
        { kind: 'folder', path: normalizedVaultPath },
      ],
    })
  })

  it('uses the last Typora-style startup override when multiple override flags are present', () => {
    expect(parseLaunchArgumentsFromArgv(['--reopen-file', '--new']).startupBehaviorOverride).toBe(
      'open-new-file',
    )
  })
})
