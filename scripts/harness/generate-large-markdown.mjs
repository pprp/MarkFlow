import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_LINE_COUNT = 180_000
const DEFAULT_OUTPUT_PATH = path.resolve('harness/fixtures/mf-large-180k.md')
const ONE_MEGABYTE = 1024 * 1024

function parseArgs(argv) {
  let lines = DEFAULT_LINE_COUNT
  let outputPath = DEFAULT_OUTPUT_PATH
  let targetBytes = null

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if ((arg === '--lines' || arg === '-l') && argv[index + 1]) {
      lines = Number.parseInt(argv[index + 1], 10)
      index += 1
      continue
    }

    if ((arg === '--output' || arg === '-o') && argv[index + 1]) {
      outputPath = path.resolve(argv[index + 1])
      index += 1
      continue
    }

    if (arg === '--bytes' && argv[index + 1]) {
      targetBytes = Number.parseInt(argv[index + 1], 10)
      index += 1
      continue
    }

    if ((arg === '--megabytes' || arg === '--mb') && argv[index + 1]) {
      targetBytes = Math.round(Number.parseFloat(argv[index + 1]) * ONE_MEGABYTE)
      index += 1
    }
  }

  if (!Number.isInteger(lines) || lines <= 0) {
    throw new Error(`--lines must be a positive integer; received ${lines}`)
  }

  if (targetBytes !== null && (!Number.isInteger(targetBytes) || targetBytes <= 0)) {
    throw new Error(`--bytes/--megabytes must resolve to a positive integer; received ${targetBytes}`)
  }

  return { lines, outputPath, targetBytes }
}

function buildLine(lineNumber) {
  if (lineNumber === 1) return '# MarkFlow large-file verification fixture'
  if (lineNumber === 2) return ''
  if (lineNumber === 3) return 'This file is generated for MF-048 and MF-049 large-document verification.'
  if (lineNumber % 2000 === 0) return `## Section ${lineNumber / 2000}`
  if (lineNumber % 400 === 0) return `- [ ] Checklist item ${lineNumber}`
  if (lineNumber % 275 === 0) return `> Blockquote line ${lineNumber} with **bold** and *italic* text`
  if (lineNumber % 250 === 0) return `| row ${lineNumber} | value ${lineNumber % 17} | status active |`
  if (lineNumber % 225 === 0) return `Reference [link ${lineNumber}](https://example.com/${lineNumber}) for viewport rendering.`
  if (lineNumber % 175 === 0) return `Inline math $x_${lineNumber}=y^2+z^2$ remains renderable.`
  if (lineNumber % 150 === 0) return `\`\`\`ts`
  if (lineNumber % 150 === 1 && lineNumber > 150) return `export const value${lineNumber} = ${lineNumber}`
  if (lineNumber % 150 === 2 && lineNumber > 150) return '```'
  if (lineNumber % 125 === 0) return `[^note-${lineNumber}]: Footnote definition ${lineNumber}.`
  if (lineNumber % 125 === 1 && lineNumber > 125) return `Footnote reference [^note-${lineNumber - 1}] appears nearby.`
  return `Paragraph ${lineNumber}: MarkFlow keeps viewport-bound decorations stable while scrolling very large files.`
}

async function main() {
  const { lines, outputPath, targetBytes } = parseArgs(process.argv.slice(2))
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })

  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' })
  const completion = new Promise((resolve, reject) => {
    stream.once('error', reject)
    stream.once('finish', resolve)
  })

  let lineNumber = 1
  let bytesWritten = 0

  while (lineNumber <= lines || (targetBytes !== null && bytesWritten < targetBytes)) {
    const nextLine = `${buildLine(lineNumber)}\n`
    bytesWritten += Buffer.byteLength(nextLine, 'utf8')

    if (!stream.write(nextLine)) {
      await new Promise((resolve) => {
        stream.once('drain', resolve)
      })
    }

    lineNumber += 1
  }

  stream.end()
  await completion

  process.stdout.write(
    `Generated ${(lineNumber - 1).toLocaleString()} lines (${bytesWritten.toLocaleString()} bytes) at ${outputPath}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
