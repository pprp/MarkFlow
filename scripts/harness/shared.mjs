import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const repoRoot = path.resolve(__dirname, '..', '..')
export const harnessDir = path.join(repoRoot, 'harness')
export const ledgerPath = path.join(harnessDir, 'feature-ledger.json')
export const progressPath = path.join(harnessDir, 'progress.md')

export function readLedger() {
  const raw = fs.readFileSync(ledgerPath, 'utf8')
  return JSON.parse(raw)
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

export function formatFeature(feature) {
  if (!feature) return 'No remaining feature found in the ledger.'

  const automated = feature.verification?.automated ?? []
  const manual = feature.verification?.manual ?? []

  return [
    `${feature.id} - ${feature.title}`,
    `status: ${feature.status} | priority: ${feature.priority} | area: ${feature.area}`,
    feature.dependsOn.length ? `depends on: ${feature.dependsOn.join(', ')}` : 'depends on: none',
    `notes: ${feature.notes}`,
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
