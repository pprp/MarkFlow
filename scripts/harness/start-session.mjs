import { countByStatus, formatFeature, getNextFeature, latestProgressEntry, readLedger, repoRoot, safeGit } from './shared.mjs'

const ledger = readLedger()
const nextFeature = getNextFeature(ledger)
const counts = countByStatus(ledger.features)
const branch = safeGit(['branch', '--show-current']) || '(no branch)'
const recentLog = safeGit(['log', '--oneline', '-5']) || '(no commits yet)'
const progress = latestProgressEntry() || '(no progress entry yet)'

console.log('MarkFlow harness session start')
console.log(`repo: ${repoRoot}`)
console.log(`branch: ${branch}`)
console.log('')
console.log(`features: ${ledger.features.length} total | verified=${counts.verified ?? 0} | ready=${counts.ready ?? 0} | planned=${counts.planned ?? 0} | blocked=${counts.blocked ?? 0}`)
console.log('')
console.log('recent git log:')
console.log(recentLog)
console.log('')
console.log('latest progress entry:')
console.log(progress)
console.log('')
console.log('next recommended feature:')
console.log(formatFeature(nextFeature))
console.log('')
console.log('recommended loop:')
console.log('1. ./harness/init.sh --smoke')
console.log('2. implement one feature only')
console.log('3. run targeted verification')
console.log('4. update harness/feature-ledger.json and harness/progress.md')
console.log('5. commit the session in a clean state')
