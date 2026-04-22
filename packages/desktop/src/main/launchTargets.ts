import * as fs from 'fs'
import * as path from 'path'

export type LaunchTarget = {
  kind: 'file' | 'folder'
  path: string
}

export type LaunchStartupBehaviorOverride = 'open-new-file' | 'restore-last-file-and-folder'

export type LaunchArguments = {
  targets: LaunchTarget[]
  startupBehaviorOverride: LaunchStartupBehaviorOverride | null
}

const SUPPORTED_FILE_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

function resolveLaunchStartupBehaviorOverride(argument: string): LaunchStartupBehaviorOverride | null {
  if (argument === '--new') {
    return 'open-new-file'
  }

  if (argument === '--reopen-file') {
    return 'restore-last-file-and-folder'
  }

  return null
}

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

export function parseLaunchArgumentsFromArgv(argv: readonly string[]): LaunchArguments {
  const targets: LaunchTarget[] = []
  const seen = new Set<string>()
  let startupBehaviorOverride: LaunchStartupBehaviorOverride | null = null

  for (const argument of argv) {
    const override = resolveLaunchStartupBehaviorOverride(argument)
    if (override) {
      startupBehaviorOverride = override
      continue
    }

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

  return {
    targets,
    startupBehaviorOverride,
  }
}

export function parseLaunchTargetsFromArgv(argv: readonly string[]): LaunchTarget[] {
  return parseLaunchArgumentsFromArgv(argv).targets
}
