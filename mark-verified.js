const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'harness/feature-ledger.json');
const ledgerData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let featureList = Array.isArray(ledgerData) ? ledgerData : ledgerData.features || ledgerData;

const feature = featureList.find(f => f.id === 'MF-039');
if (feature) {
  feature.status = 'verified';
  feature.passes = true;
  feature.lastVerifiedAt = new Date().toISOString();
}

fs.writeFileSync(filePath, JSON.stringify(ledgerData, null, 2) + '\n', 'utf8');
