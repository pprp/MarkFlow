import * as fs from 'fs'
import * as path from 'path'

export type LaunchTarget = {
  kind: 'file' | 'folder'
  path: string
}

const SUPPORTED_FILE_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

function resolveLaunchTarget(candidatePath: string): LaunchTarget | null {
  if (!candidatePath || candidatePath.startsWith('-')) {
    return null
  }

  const resolvedPath = path.resolve(candidatePath)
  if (!fs.existsSync(resolvedPath)) {
    return null
  }

  const normalizedPath = fs.realpathSync(resolvedPath)
  const stats = fs.statSync(normalizedPath)
  if (stats.isDirectory()) {
    return {
      kind: 'folder',
      path: normalizedPath,
    }
  }

  if (!stats.isFile()) {
    return null
  }

  if (!SUPPORTED_FILE_EXTENSIONS.has(path.extname(resolvedPath).toLowerCase())) {
    return null
  }

  return {
    kind: 'file',
    path: normalizedPath,
  }
}

export function parseLaunchTargetsFromArgv(argv: readonly string[]): LaunchTarget[] {
  const targets: LaunchTarget[] = []
  const seen = new Set<string>()

  for (const argument of argv) {
    const target = resolveLaunchTarget(argument)
    if (!target) {
      continue
    }

    const key = `${target.kind}:${target.path}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    targets.push(target)
  }

  return targets
}
