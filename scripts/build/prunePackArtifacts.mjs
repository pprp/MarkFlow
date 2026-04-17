import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const outputDir = path.join(repoRoot, 'dist-desktop')

const keepFilePatterns = [
  /\.AppImage$/u,
  /\.blockmap$/u,
  /\.deb$/u,
  /\.dmg$/u,
  /\.exe$/u,
  /\.yml$/u,
  /\.zip$/u,
]

if (!fs.existsSync(outputDir)) {
  process.exit(0)
}

for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.isFile() && keepFilePatterns.some((pattern) => pattern.test(entry.name))) {
    continue
  }

  fs.rmSync(path.join(outputDir, entry.name), { recursive: true, force: true })
}
