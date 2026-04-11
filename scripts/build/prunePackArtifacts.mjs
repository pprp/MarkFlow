import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const outputDir = path.join(repoRoot, 'dist-mac')

if (!fs.existsSync(outputDir)) {
  process.exit(0)
}

for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.zip')) {
    continue
  }

  fs.rmSync(path.join(outputDir, entry.name), { recursive: true, force: true })
}
