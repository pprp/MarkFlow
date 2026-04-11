const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const pointerPolyfill = `
    // PointerEvent polyfill for jsdom
    if (!window.PointerEvent) {
      ;(window as any).PointerEvent = class PointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, params: any = {}) {
          super(type, params);
          this.pointerId = params.pointerId || 1;
        }
      };
    }
`;

content = content.replace(/    \/\/ PointerEvent polyfill for jsdom[\s\S]*?    \}/, pointerPolyfill.trim());

fs.writeFileSync(filePath, content, 'utf8');
