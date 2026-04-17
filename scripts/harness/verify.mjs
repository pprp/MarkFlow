import fs from 'node:fs'
import path from 'node:path'
import {
  countByStatus,
  featuresDir,
  getNextFeature,
  harnessDir,
  ledgerPath,
  progressPath,
  readFeatureContent,
  readLedger,
  readLedgerMetadata,
} from './shared.mjs'

const VALID_STATUS = new Set(['verified', 'ready', 'planned', 'blocked', 'regression'])
const FEATURE_METADATA_KEYS = new Set([
  'id',
  'title',
  'category',
  'area',
  'priority',
  'status',
  'passes',
  'lastVerifiedAt',
  'dependsOn',
  'notesRef',
])

const failures = []

if (!fs.existsSync(harnessDir)) failures.push('Missing `harness/` directory.')
if (!fs.existsSync(featuresDir)) failures.push('Missing `harness/features/` directory.')
if (!fs.existsSync(ledgerPath)) failures.push('Missing `harness/feature-ledger.json`.')
if (!fs.existsSync(progressPath)) failures.push('Missing `harness/progress.md`.')

let ledger

try {
  ledger = readLedgerMetadata()
} catch (error) {
  failures.push(`Unable to parse feature ledger JSON: ${error.message}`)
}

if (ledger) {
  if (!Array.isArray(ledger.instructions) || ledger.instructions.length === 0) {
    failures.push('Ledger must contain a non-empty `instructions` array.')
  }

  if (!Array.isArray(ledger.features) || ledger.features.length === 0) {
    failures.push('Ledger must contain a non-empty `features` array.')
  } else {
    const ids = new Set()

    for (const feature of ledger.features) {
      const extraKeys = Object.keys(feature).filter((key) => !FEATURE_METADATA_KEYS.has(key))
      if (extraKeys.length > 0) {
        failures.push(`Feature ${feature.id ?? '(unknown)'} has non-metadata keys in JSON: ${extraKeys.join(', ')}`)
      }

      if (typeof feature.id !== 'string' || feature.id.length === 0) {
        failures.push('Every feature must have a non-empty string `id`.')
      } else if (ids.has(feature.id)) {
        failures.push(`Duplicate feature id detected: ${feature.id}`)
      } else {
        ids.add(feature.id)
      }

      if (!VALID_STATUS.has(feature.status)) {
        failures.push(`Feature ${feature.id} has invalid status: ${feature.status}`)
      }

      if (typeof feature.passes !== 'boolean') {
        failures.push(`Feature ${feature.id} must define boolean \`passes\`.`)
      }

      if (!Number.isInteger(feature.priority) || feature.priority < 1) {
        failures.push(`Feature ${feature.id} must define a positive integer priority.`)
      }

      if (!Array.isArray(feature.dependsOn)) {
        failures.push(`Feature ${feature.id} must include a \`dependsOn\` array.`)
      }

      if (typeof feature.notesRef !== 'string' || feature.notesRef.length === 0) {
        failures.push(`Feature ${feature.id} must define a non-empty \`notesRef\`.`)
      } else {
        const notesBasename = path.basename(feature.notesRef)
        if (!feature.notesRef.startsWith('features/')) {
          failures.push(`Feature ${feature.id} notesRef must live under \`harness/features/\`: ${feature.notesRef}`)
        }
        if (notesBasename !== `${feature.id}.md`) {
          failures.push(`Feature ${feature.id} notesRef must point to ${feature.id}.md: ${feature.notesRef}`)
        }
      }

      if (feature.passes && feature.status !== 'verified') {
        failures.push(`Feature ${feature.id} cannot have \`passes: true\` unless status is \`verified\`.`)
      }

      if (!feature.passes && feature.status === 'verified') {
        failures.push(`Feature ${feature.id} cannot have status \`verified\` while \`passes\` is false.`)
      }

      try {
        const content = readFeatureContent(feature)
        if (!Array.isArray(content.steps) || content.steps.length === 0) {
          failures.push(`Feature ${feature.id} must include at least one step in ${feature.notesRef}.`)
        }

        if (!Array.isArray(content.verification.automated) || !Array.isArray(content.verification.manual)) {
          failures.push(`Feature ${feature.id} must include automated/manual verification lists in ${feature.notesRef}.`)
        }
      } catch (error) {
        failures.push(`Feature ${feature.id} notes could not be read: ${error.message}`)
      }
    }

    const knownIds = new Set(ledger.features.map((feature) => feature.id))
    for (const feature of ledger.features) {
      for (const dependency of feature.dependsOn) {
        if (!knownIds.has(dependency)) {
          failures.push(`Feature ${feature.id} depends on unknown feature id: ${dependency}`)
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Harness verification failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

const resolvedLedger = readLedger()
const counts = countByStatus(resolvedLedger.features)
const next = getNextFeature(resolvedLedger)

console.log('Harness verification passed.')
console.log(
  `features: ${resolvedLedger.features.length} total | verified=${counts.verified ?? 0} | ready=${counts.ready ?? 0} | planned=${counts.planned ?? 0} | blocked=${counts.blocked ?? 0} | regression=${counts.regression ?? 0}`,
)
if (next) {
  console.log(`next: ${next.id} - ${next.title}`)
} else {
  console.log('next: all features are currently marked as passing')
}
