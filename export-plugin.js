const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/extensions/spellCheck.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("const spellCheckExclusionPlugin", "export const spellCheckExclusionPlugin");

fs.writeFileSync(filePath, content, 'utf8');
