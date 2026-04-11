const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/MarkFlowEditor.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/    \)\n  }\n  }/g, "    )\n  }");

fs.writeFileSync(filePath, content, 'utf8');
