import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const repoRoot = path.resolve(__dirname, '..', '..')
export const harnessDir = path.join(repoRoot, 'harness')
export const featuresDir = path.join(harnessDir, 'features')
export const ledgerPath = path.join(harnessDir, 'feature-ledger.json')
export const progressPath = path.join(harnessDir, 'progress.md')
const featureContentCache = new Map()
const featureSections = ['Notes', 'Steps', 'Automated Verification', 'Manual Verification']

export function readLedgerMetadata() {
  const raw = fs.readFileSync(ledgerPath, 'utf8')
  return JSON.parse(raw)
}

function resolveNotesPath(notesRef) {
  const resolvedPath = path.resolve(harnessDir, notesRef)
  const relativeToHarness = path.relative(harnessDir, resolvedPath)

  if (!fs.existsSync(resolvedPath)) {
    const fallbackFromHarnessFeatures = path.resolve(featuresDir, path.basename(notesRef))
    if (fs.existsSync(fallbackFromHarnessFeatures)) {
      return fallbackFromHarnessFeatures
    }
  }

  if (relativeToHarness.startsWith('..') || path.isAbsolute(relativeToHarness)) {
    throw new Error(`Feature notesRef must stay inside harness/: ${notesRef}`)
  }

  return resolvedPath
}

function splitFeatureSections(raw, notesRef) {
  const sections = new Map()
  let activeSection = null

  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^## (Notes|Steps|Automated Verification|Manual Verification)$/.exec(line.trim())
    if (match) {
      activeSection = match[1]
      if (sections.has(activeSection)) {
        throw new Error(`Feature note file has duplicate section \`${activeSection}\`: ${notesRef}`)
      }
      sections.set(activeSection, [])
      continue
    }

    if (!activeSection) continue
    sections.get(activeSection).push(line)
  }

  for (const section of featureSections) {
    if (!sections.has(section)) {
      throw new Error(`Feature note file is missing \`## ${section}\`: ${notesRef}`)
    }
  }

  return sections
}

function parseMarkdownList(lines, label, notesRef) {
  const items = []
  let currentItem = null

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed.trim().length === 0) continue

    if (trimmed.startsWith('- ')) {
      if (currentItem !== null) items.push(currentItem.trim())
      currentItem = trimmed.slice(2).trim()
      continue
    }

    if (/^\s+/.test(line) && currentItem !== null) {
      currentItem = `${currentItem} ${line.trim()}`
      continue
    }

    throw new Error(`Feature note file has invalid ${label} list syntax: ${notesRef}`)
  }

  if (currentItem !== null) items.push(currentItem.trim())

  return items
}

export function readFeatureContent(feature) {
  if (featureContentCache.has(feature.notesRef)) {
    return featureContentCache.get(feature.notesRef)
  }

  if (typeof feature.notesRef !== 'string' || feature.notesRef.length === 0) {
    throw new Error(`Feature ${feature.id} must define a non-empty notesRef.`)
  }

  const notesPath = resolveNotesPath(feature.notesRef)
  const raw = fs.readFileSync(notesPath, 'utf8')
  const sections = splitFeatureSections(raw, feature.notesRef)
  const content = {
    notes: sections.get('Notes').join('\n').trim(),
    steps: parseMarkdownList(sections.get('Steps'), 'steps', feature.notesRef),
    verification: {
      automated: parseMarkdownList(sections.get('Automated Verification'), 'automated verification', feature.notesRef),
      manual: parseMarkdownList(sections.get('Manual Verification'), 'manual verification', feature.notesRef),
    },
  }

  if (content.notes.length === 0) {
    throw new Error(`Feature note file must include non-empty notes: ${feature.notesRef}`)
  }

  featureContentCache.set(feature.notesRef, content)
  return content
}

export function readLedger() {
  const ledger = readLedgerMetadata()
  return {
    ...ledger,
    features: ledger.features.map((feature) => ({
      ...feature,
      ...readFeatureContent(feature),
    })),
  }
}

export function readProgress() {
  return fs.readFileSync(progressPath, 'utf8')
}

export function sortFeatures(features) {
  return [...features].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority
    return left.id.localeCompare(right.id)
  })
}

export function getNextFeature(ledger) {
  return sortFeatures(ledger.features).find((feature) => !feature.passes && feature.status !== 'blocked') ?? null
}

export function countByStatus(features) {
  return features.reduce((counts, feature) => {
    counts[feature.status] = (counts[feature.status] ?? 0) + 1
    return counts
  }, {})
}

export function safeGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export function latestProgressEntry() {
  const content = readProgress().trim()
  if (!content) return ''

  const entries = content.split(/\n(?=### )/g)
  const latest = entries.at(-1) ?? ''
  return latest.trim()
}

function formatTextBlock(label, text) {
  return [
    `${label}:`,
    ...text.split('\n').map((line) => (line.length > 0 ? `  ${line}` : '  ')),
  ]
}

export function formatFeature(feature) {
  if (!feature) return 'No remaining feature found in the ledger.'

  const automated = feature.verification?.automated ?? []
  const manual = feature.verification?.manual ?? []

  return [
    `${feature.id} - ${feature.title}`,
    `status: ${feature.status} | priority: ${feature.priority} | area: ${feature.area}`,
    feature.dependsOn.length ? `depends on: ${feature.dependsOn.join(', ')}` : 'depends on: none',
    ...formatTextBlock('notes', feature.notes),
    'steps:',
    ...feature.steps.map((step, index) => `  ${index + 1}. ${step}`),
    automated.length ? 'automated verification:' : null,
    ...automated.map((item) => `  - ${item}`),
    manual.length ? 'manual verification:' : null,
    ...manual.map((item) => `  - ${item}`),
  ]
    .filter(Boolean)
    .join('\n')
}
