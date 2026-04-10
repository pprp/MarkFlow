import { formatFeature, getNextFeature, readLedger } from './shared.mjs'

const ledger = readLedger()
const nextFeature = getNextFeature(ledger)

console.log(formatFeature(nextFeature))
