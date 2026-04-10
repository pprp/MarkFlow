# MarkFlow Harness Progress

## Working Agreements

- Start each session with `pnpm harness:start`.
- Run `./harness/init.sh --smoke` before starting new feature work.
- Keep changes scoped to one feature unless a prerequisite bug blocks progress.
- End each session by updating this file and `harness/feature-ledger.json`.

## Session Log

### 2026-04-09 - Harness bootstrap

- Author: Codex
- Focus: create a long-running agent harness tailored to MarkFlow
- What changed:
  - added a durable project spec, JSON feature ledger, and append-only progress log under `harness/`
  - added helper scripts for session start, next-feature selection, and ledger verification
  - added `harness/init.sh` plus root package scripts to standardize smoke tests and session boot
  - normalized workspace test commands so `pnpm test` works even in packages that do not have test files yet
  - fixed `codeBlockDecoration` so fenced code block decorations no longer try to replace across line breaks during smoke tests
- Verification:
  - `pnpm harness:verify`
  - `pnpm test`
- Next recommended feature:
  - `MF-004` - preserve editor document state when toggling between WYSIWYG and source modes
- Risks / notes:
  - the harness currently relies on unit tests and manual smoke checks because there is no browser automation suite yet
  - desktop file open/save flows are identified as near-term priorities but still need renderer-side integration

### 2026-04-09 - Core editor and desktop fixes

- Author: Codex
- Focus: remove current build/lint/runtime blockers and fix the highest-priority editor and desktop workflows
- What changed:
  - preserved a single CodeMirror EditorView across view-mode toggles so document text, selection, and undo history survive WYSIWYG/source switching
  - turned the editor into a controlled buffer that syncs with desktop file events instead of hard-resetting to static starter content
  - routed Electron File menu actions back through the renderer so save and save-as use the live editor buffer
  - added startup hydration through `getCurrentDocument()` to recover already-open files after a fresh renderer session
  - fixed desktop build output paths, package entry points, IPC handler re-registration, and pending external file-open handling
  - added workspace ESLint flat config and cleaned remaining TypeScript/build issues
  - added regression tests for editor state preservation and desktop app document lifecycle
- Verification:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `./harness/init.sh --smoke`
- Newly verified features:
  - `MF-004`
  - `MF-007`
  - `MF-008`
  - `MF-009`
- Next recommended feature:
  - `MF-005` - add direct verification for list and blockquote WYSIWYG decorations
- Risks / notes:
  - desktop file flows now have renderer-level integration coverage, but a true Electron end-to-end runner is still missing
  - production editor bundles are currently large because CodeMirror language data is bundled eagerly

### 2026-04-10 - MF-005 nested decoration verification

- Author: Codex
- Focus: refresh the Typora replication ledger and close one editor feature end to end
- What changed:
  - refreshed Typora-backed ledger notes by updating `MF-005` and `MF-011`, and adding `MF-024` for horizontal rules plus `MF-025` for YAML front matter preservation
  - extended `listAndBlockquoteDecoration.test.tsx` to cover nested lists and nested blockquotes in both focused and unfocused caret states
  - fixed nested blockquote decoration ordering so stacked quote markers hide correctly and no duplicate line decorations are inserted
  - marked `MF-005` as verified after automated coverage and harness verification passed
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor test:run -- listAndBlockquoteDecoration.test.tsx`
  - `pnpm --filter @markflow/editor test:run`
  - `node scripts/harness/verify.mjs`
- Newly verified features:
  - `MF-005`
- Next recommended feature:
  - `MF-010` - Rendered links are clickable and open externally from the desktop shell
- Risks / notes:
  - nested list and blockquote behavior is now covered in unit tests, but in-app visual fidelity is still only covered by an optional smoke check
  - `MF-011` and `MF-024` are now recorded as ready follow-ups once link handling is verified

### 2026-04-10 - MF-010 external link path partial

- Author: Codex
- Focus: refresh Typora link expectations and implement the smallest verified subset of link navigation
- What changed:
  - refreshed `MF-010` against Typora's link docs so the ledger now calls out modifier-click behavior and the broader gap around internal, local-file, reference, and auto URL links
  - rendered unfocused inline markdown links as anchor markup in WYSIWYG mode and added `Cmd`/`Ctrl`+click handling in the editor so external URLs route through `window.open(..., '_blank')`
  - extracted desktop external-link helpers and added focused tests for Electron `will-navigate` and `setWindowOpenHandler` behavior
  - kept `MF-010` as unpassed because the current ledger scope is broader than the external inline-link path implemented here, and desktop manual verification still has not been run
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor test:run -- linkDecoration.test.tsx MarkFlowEditor.test.tsx`
  - `pnpm --filter @markflow/desktop test:run -- src/main/externalLinks.test.ts`
  - `pnpm test`
  - `node scripts/harness/verify.mjs`
- Newly verified features:
  - none
- Next recommended feature:
  - `MF-010` - finish internal/reference/local link handling or split that broader Typora link scope into smaller ledger items before verifying
- Risks / notes:
  - current editor behavior only covers inline external links; `#heading` anchors, reference-style links, auto URLs, and local markdown file links are still outside the tested/verified path
  - reviewer acceptance for this run depends on keeping `MF-010` unverified until a real desktop manual check is completed

### 2026-04-10 - MF-024 horizontal rule verification

- Author: Codex
- Focus: close one ready Typora-replication feature end to end without expanding scope
- What changed:
  - added `MF-028` to the ledger for Typora-style in-document find and replace based on Typora search docs
  - extended `listAndBlockquoteDecoration.test.tsx` with focused horizontal-rule coverage for unfocused `---`, focused `***`, and adjacent paragraph integrity
  - confirmed the existing `HorizontalRule` decoration path already worked, so no product code changes were needed for `MF-024`
  - fixed a ledger mismatch discovered in review by restoring `MF-011` to `ready` and marking `MF-024` as verified only after the targeted tests and harness verification had passed
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor test:run -- listAndBlockquoteDecoration.test.tsx`
  - `node scripts/harness/verify.mjs`
- Newly verified features:
  - `MF-024`
- Next recommended feature:
  - `MF-010` - finish internal/reference/local link handling or split the remaining scope before trying to verify it
- Risks / notes:
  - `MF-024` now has targeted automated coverage, but it still lacks a richer same-view visual smoke pass in the desktop shell
  - `MF-011` remains ready and should only be verified after direct image preview and broken-image coverage exists

### 2026-04-10 - Agent team scaffold and MF-005 verification hardening

- Author: Codex
- Focus: create a durable multi-agent loop for Typora gap discovery while making `MF-005` verification less brittle
- What changed:
  - added `harness/agent-team.md` to define the `Researcher -> Implementer -> Reviewer -> Dispatcher` cycle, file ownership boundaries, and completion criteria for this repo
  - expanded the Typora comparison backlog in `harness/feature-ledger.json` with `MF-019` through `MF-023` using official Typora docs as the source basis
  - replaced DOM-text assertions in `packages/editor/src/editor/__tests__/listAndBlockquoteDecoration.test.tsx` with CodeMirror decoration-set assertions so list, task-list, ordered-list, blockquote, nested blockquote, and horizontal-rule coverage stays stable under JSDOM
  - kept the nested blockquote fix in place and added `.mf-list-order-marker` styling so ordered list widgets render consistently with bullet widgets
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/listAndBlockquoteDecoration.test.tsx`
  - `pnpm --filter @markflow/editor test:run`
  - `./harness/init.sh --smoke`
- Newly verified features:
  - none
- Next recommended feature:
  - `MF-010` - finish internal/reference/local link handling or split the remaining scope before trying to verify it
- Risks / notes:
  - `MF-005` remains verified, but the strongest evidence is still unit-level decoration coverage rather than a true desktop visual smoke run
  - the agent loop is now documented in-repo, but it still depends on a human or automation layer to re-trigger the next cycle

### 2026-04-10 - Ralph PRD bug-fix sweep

- Author: Codex
- Focus: close the four features defined in `ralph/prd.json` and verify them through the full Ralph loop
- What changed:
  - wired `Cmd`/`Ctrl` + `/` through `MarkFlowEditor` into `App` so the editor can toggle WYSIWYG/source mode without using the toolbar button
  - made rendered task-list checkboxes write `[ ]` and `[x]` back into markdown source with focused regression coverage
  - threaded the active document file path into image decorations so relative image sources resolve against the opened markdown file
  - converted desktop save/save-as writes to async I/O, separated save RPC results from the `file-saved` event payload, and fixed the failed-save-as path so it does not corrupt the in-memory current file path
  - added Ralph context/plan/test-spec artifacts under `.omx/` and marked all four `ralph/prd.json` stories as passed
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/linkDecoration.test.tsx src/editor/__tests__/listAndBlockquoteDecoration.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/desktop test:run -- src/main/fileManager.test.ts src/main/externalLinks.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `./harness/init.sh --smoke`
  - architect verification: APPROVED
- Newly verified features:
  - Ralph `US-001`
  - Ralph `US-002`
  - Ralph `US-003`
  - Ralph `US-004`
- Next recommended feature:
  - `MF-010` - finish internal/reference/local link handling or split the remaining scope before trying to verify it
- Risks / notes:
  - automated coverage exercises the `ctrlKey` shortcut path, but there is still no platform-specific macOS check for the `metaKey` variant
  - image-path verification is unit/integration level; there is still no Electron end-to-end run with a real local image asset

### 2026-04-10 - MF-011 image preview verification

- Author: Codex
- Focus: close the inline image preview feature against Typora's local-path expectations without broadening into image insertion work
- What changed:
  - corrected the `MF-011` ledger entry so it reflects the actual Typora gap: inline preview now covers remote URLs, document-relative local paths, and absolute filesystem paths, while image insertion remains separate under `MF-029`
  - finished the pending image-path closure in `linkDecoration.ts` by treating absolute filesystem paths as `file://` URLs and preserving already-addressable schemes such as `data:` and protocol-relative CDN URLs
  - kept the implementation scoped to the existing image decoration path and refreshed `linkDecoration.test.tsx` plus `App.test.tsx` coverage so the App-level file path bridge and image preview behavior are both evidenced
  - marked `MF-011` as verified after the targeted and package-level editor tests passed and the reviewer accepted the resulting workspace state
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/linkDecoration.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor test:run`
  - `node scripts/harness/verify.mjs`
- Newly verified features:
  - `MF-011`
- Next recommended feature:
  - `MF-010` - finish internal anchors, reference links, auto URLs, and local markdown link routing or split that remaining Typora link scope before trying to verify it
- Risks / notes:
  - `linkDecoration.ts` still relies on regex extraction for image syntax, so image destinations with titles or nested parentheses remain the main future regression surface
  - `MF-029` is still untouched and should remain separate from preview verification because Typora treats image insertion/upload as a different capability

### 2026-04-10 - MF-014 + MF-023 math and Mermaid rendering

- Author: Copilot
- Focus: implement KaTeX math rendering and Mermaid diagram rendering in WYSIWYG mode
- What changed:
  - added `katex` and `mermaid` as dependencies in `@markflow/editor`; added `@types/katex` as dev dependency
  - created `packages/editor/src/editor/decorations/mathDecoration.ts` — handles inline `$...$`, single-line `$$expr$$`, and multi-line `$$\n...\n$$` blocks via KaTeX; uses line-by-line `Decoration.replace` to stay within the CM6 ViewPlugin constraint (no replace decorations that span line breaks); cursor inside range reveals raw source
  - created `packages/editor/src/editor/decorations/mermaidDecoration.ts` — detects `FencedCode` nodes with `CodeInfo` = "mermaid" via the lezer syntax tree; renders SVG asynchronously via a lazy-loaded Mermaid instance; SVG cache prevents redundant re-renders; loading and error states handled gracefully; cursor inside block reveals raw fenced source
  - registered both decorations in `MarkFlowEditor.tsx` `getWysiwygExtensions()` alongside existing WYSIWYG decorations
  - imported `katex/dist/katex.min.css` in `main.tsx` for proper KaTeX font rendering
  - added CSS classes `.mf-math-inline`, `.mf-math-block`, `.mf-mermaid`, `.mf-mermaid-loading`, `.mf-mermaid-error` to `global.css`
  - added 13 tests in `mathDecoration.test.ts` and 10 tests in `mermaidDecoration.test.ts`; all 68 editor tests pass
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/mathDecoration.test.ts src/editor/__tests__/mermaidDecoration.test.ts`
  - `pnpm --filter @markflow/editor test:run`
- Newly verified features:
  - `MF-014` — math blocks via KaTeX
  - `MF-023` — Mermaid diagram fences
- Next recommended feature:
  - `MF-010` — rendered links, internal anchors, reference links, auto URLs
- Risks / notes:
  - Mermaid SVG rendering is async: the widget shows a loading placeholder on first render; subsequent renders with the same source hit the in-memory cache
  - Block math multi-line detection requires `$$` on its own line (trimmed); `$$expr$$` inline is also supported as display math on a single line
  - KaTeX CSS is bundled via Vite; if the app is loaded without Vite (e.g., plain HTML), the CSS link must be added manually
