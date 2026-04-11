import fs from 'fs'

const ledgerPath = './harness/feature-ledger.json'
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'))

const feature = ledger.features.find(f => f.id === 'MF-043')
if (feature) {
  feature.passes = true
  feature.lastVerifiedAt = new Date().toISOString()
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
  console.log('Updated MF-043 to passes = true')
} else {
  console.error('Feature MF-043 not found')
}
