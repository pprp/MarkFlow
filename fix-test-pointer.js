const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const pointerPolyfill = `
    // PointerEvent polyfill for jsdom
    if (!window.PointerEvent) {
      window.PointerEvent = class PointerEvent extends MouseEvent {
        pointerId;
        constructor(type, params = {}) {
          super(type, params);
          this.pointerId = params.pointerId || 1;
        }
      };
    }
`;

content = content.replace(/    \/\/ Mock getBoundingClientRect/, pointerPolyfill + "    // Mock getBoundingClientRect");

fs.writeFileSync(filePath, content, 'utf8');
