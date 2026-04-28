import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const entitlementsPath = path.join(repoRoot, 'packages/desktop/build/entitlements.mac.plist')

function hasDeveloperIdentity(context) {
  const identity = context?.packager?.platformSpecificBuildOptions?.identity

  return typeof identity === 'string' && identity.trim() !== '' && identity.trim() !== '-'
}

export default async function adHocSignMacApp(context) {
  if (context.electronPlatformName !== 'darwin' || process.platform !== 'darwin') {
    return
  }

  if (process.env.MARKFLOW_SKIP_ADHOC_SIGN === '1' || hasDeveloperIdentity(context)) {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot ad-hoc sign missing macOS app bundle: ${appPath}`)
  }

  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--timestamp=none',
      '--options',
      'runtime',
      '--entitlements',
      entitlementsPath,
      appPath,
    ],
    { stdio: 'inherit' },
  )
}
