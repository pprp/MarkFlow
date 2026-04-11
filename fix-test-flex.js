const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/style\.flex/g, "style.flexGrow");

fs.writeFileSync(filePath, content, 'utf8');
