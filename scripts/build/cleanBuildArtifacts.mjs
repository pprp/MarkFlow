import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '../..')

const targets = [
  path.join(repoRoot, 'packages/editor/dist'),
  path.join(repoRoot, 'packages/desktop/dist'),
  path.join(repoRoot, 'dist-desktop'),
  path.join(repoRoot, 'dist-mac'),
  path.join(repoRoot, 'dist-win'),
  path.join(repoRoot, 'dist-linux'),
]

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true })
}

for (const entry of fs.readdirSync(repoRoot)) {
  if (/^markflow-desktop-.*\.tgz$/u.test(entry)) {
    fs.rmSync(path.join(repoRoot, entry), { force: true })
  }
}
