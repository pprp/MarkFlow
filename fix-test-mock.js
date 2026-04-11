const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const testFile = content.replace(/let newRatio = \(e\.clientX - rect\.left\) \/ rect\.width/g, "let newRatio = (e.clientX - rect.left) / rect.width");
fs.writeFileSync(filePath, testFile, 'utf8');
