### 2026-04-19T08:42:10Z - MF-051 verified in a live renderer UI session

- Author: Codex
- Focus: strict one-feature completion for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Launched `pnpm desktop` to confirm the dev shell still boots.
  - Opened the live renderer at `http://localhost:5173` in a headed Microsoft Edge Playwright session because `Computer Use` access was unavailable and the feature scope is renderer-only (`@markflow/editor`).
  - Did not modify source or implementation files for `MF-051`; only `harness/features/MF-051.md`, `harness/feature-ledger.json`, and `harness/progress.md` were updated after verification succeeded.
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts` passed on the current tree: `42` test files, `459` tests passed, `3` skipped, `0` failed.
  - Manual UI verification passed in the live renderer session:
    - clicking `Proof Surface` in the outline scrolled the editor from `scrollTop=0` to `scrollTop=1224` and revealed the target section at the top of the canvas.
    - continuing to wheel-scroll moved the active outline item from `A Pull Quote` to `Proof Surface`, confirming viewport-driven sync.
    - adding `## Browser Verification Heading` in source mode immediately added a ninth outline item, and a single undo immediately removed it again.
  - `pnpm harness:verify` passed after the ledger/progress updates.
- Remaining risks:
  - No `MF-051`-specific blockers remain.
  - Manual acceptance was captured against the live renderer session rather than direct Electron window control; `pnpm desktop` launched successfully in the same session, and the feature logic under test lives in `@markflow/editor`.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-051.status=verified`, `MF-051.passes=true`, and `MF-051.lastVerifiedAt=2026-04-19`.
- Next recommended feature:
  - `MF-053` - Fuzzy document-wide search highlights all matches and jumps between them with keyboard shortcuts.

### 2026-04-19T08:23:09Z - MF-051 verification loop (automation pass, desktop UI proof still blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation), with startup protocol and truthful verification state preserved.
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Ran the required feature verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Ran `pnpm harness:verify`.
  - Launched a real desktop dev session with `pnpm desktop` to pursue the missing `MF-051` manual proof path.
  - Did not modify source or implementation files; existing `MF-051` code remains unchanged.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed in this environment.
  - The required feature command passed on the current tree: `42` test files, `457` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - The missing acceptance evidence is still the trusted desktop manual check for outline click-to-jump, viewport-driven active-heading sync while scrolling, and live heading add/remove updates.
  - Although `pnpm desktop` launched Electron successfully, this session does not have a trustworthy window-control/inspection path for acceptance. `Computer Use` access was unavailable, and alternate headed-browser probing did not produce reliable UI evidence for ledger promotion.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) because the required manual desktop proof was not completed.
- Next recommended feature:
  - Continue with `MF-051` only. Re-run `./harness/init.sh --desktop-dev` in a session with trusted desktop UI access, open a multi-section markdown fixture, verify outline click-to-jump plus scroll-sync plus live heading add/remove, and only then set `status=verified`, `passes=true`, and `lastVerifiedAt`.

### 2026-04-17T22:06:14+08:00 - MF-051 protocol loop (automation pass, manual UI blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation), executed with the environment constraint that manual desktop UI verification is unavailable.
- What changed:
  - Ran required feature command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No source edits were required this round; existing `MF-051` implementation remains unchanged.
- Verification:
  - Targeted feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual scroll-sync check is still blocked in this environment (no trusted desktop session).
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` in an environment with trusted desktop UI access; only update ledger pass state after both automated and manual checks pass.

### 2026-04-17T22:10:31+08:00 - MF-051 protocol-compliant loop (automation verified, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Ran required automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Ran `pnpm harness:verify`.
  - Did not modify source code for `MF-051` in this round; existing implementation remains in place.
- Verification:
  - Feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
  - `./harness/init.sh --smoke` passed in this environment.
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync validation for `MF-051` cannot be executed here (no trusted UI session), so behavior against real viewport movement is not yet human-proven.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` once a desktop UI session is available; only then set `status=verified`, `passes=true`, and `lastVerifiedAt`.

### 2026-04-17T14:02:30Z - MF-051 protocol loop (automation verified, manual UI blocked)

- Author: Codex
- Focus: continue one-feature loop for `MF-051` (outline live scroll-sync and heading jump navigation), preserving ledger truthfulness when manual desktop check cannot run.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran feature verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
- Verification:
  - Feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `./harness/init.sh --smoke` passed (executes full test pipeline in this workspace).
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync validation for `MF-051` is blocked in this environment (no trusted UI session), so active-outline behavior against real multi-section scroll remains unverified here.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-071` only after completing trusted manual `MF-051` scroll-sync validation in an environment with desktop UI access, then update ledger only when both automated and manual checks are true.

### 2026-04-17T21:58:45Z - MF-051 protocol-compliant session (automation + no-op source edits)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Ran feature automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No additional source changes were required in this pass; existing MF-051 implementation remains unchanged.
- Verification:
  - MF-051 feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
  - `./harness/init.sh --smoke` passed (including full test suite execution path).
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync verification for MF-051 is still blocked in this environment (no UI session), so active-outline tracking against real scrolling cannot be validated here.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Complete trusted manual multi-section scroll-sync validation for `MF-051` in desktop UI, then set `status/passes/lastVerifiedAt` only when both automated and manual checks are satisfied.

### 2026-04-17T13:55:31Z - MF-051 session loop (automation verified, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and jump navigation).
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran feature verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No source or implementation files changed; this pass validated existing MF-051 fix behavior.
- Verification:
  - Feature automation passed: `451` tests, `3` skipped, `0` failed (`40` test files executed).
  - `pnpm harness:verify` passed.
  - `./harness/init.sh --smoke` passed (internally running full-suite verification).
- Remaining risk / blocker:
  - Trusted manual desktop verification for scroll-sync tracking remains blocked in this environment; unable to validate viewport-driven outline highlighting against real UI interaction and scroll events.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Complete trusted manual scroll-sync check for `MF-051` in a desktop UI session, then promote `status/passes/lastVerifiedAt` when proof is present.

### 2026-04-17T21:52:08:z - MF-051 protocol-compliant one-feature session (automation pass, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for .
- What changed:
  - Ran 
> markflow@0.1.0 harness:start /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/start-session.mjs

MarkFlow harness session start
repo: /Users/pprp/Workspace/MarkFlow
branch: main

features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0

recent git log:
76203bd Preserve MF-051 protocol truthfulness while manual scroll-sync remains blocked
5264898 Preserve MF-051 protocol truthfulness while manual scroll-sync is blocked
c9939ce Defer MF-051 completion until trusted manual scroll-sync proof is available
342efb3 Close MF-051 session loop with truthful verification state and progress evidence
044ab4b Preserve MF-051 verification truthfulness with protocol-compliant session logging

latest progress entry:
### 2026-04-17 - MF-051 loop rerun (automation-only, manual scroll-sync blocked)

- Author: Codex
- Focus: one-feature protocol completion for `MF-051` in this session.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran `MF-051` automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Did not modify source or implementation files for the feature; no new code changes required in this round.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed.
  - MF-051 automation passed: `40` test files, `451` tests passed, `3` skipped.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop verification for MF-051 active outline scrolling sync (scroll a multi-section document and confirm the active heading follows viewport) cannot be executed in this environment.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` and complete trusted manual scroll-sync verification, then promote `status`, `passes`, `lastVerifiedAt` only after real proof.

next recommended feature:
MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation
status: ready | priority: 2 | area: @markflow/editor
depends on: MF-050
notes:
  Implemented on 2026-04-15 in `packages/editor/src/App.tsx` and `packages/editor/src/editor/MarkFlowEditor.tsx` by sourcing outline entries from the background symbol table, keeping heading additions/renames asynchronous, and combining explicit navigation intent with editor scroll events so the active outline item tracks the current section without blocking on full-document reparses. Automated coverage in `src/__tests__/App.test.tsx`, `src/editor/__tests__/MarkFlowEditor.test.tsx`, and `src/editor/__tests__/outline.test.ts` passed on 2026-04-15 with the listed editor test command. `passes` remains false because the manual desktop scroll-sync check is still pending. BUG (found 2026-04-16, detailed live-preview test, starter document): The active-heading indicator does NOT track scroll when the document fits the rendered viewport. `activeOutlineAnchor` is computed from `activeTab.cursorPosition ?? activeTab.viewportPosition ?? 0` (App.tsx ~line 1592), and `viewportPosition` is fed by `update.view.viewport.from` / `view.scrollDOM scroll handler` in `MarkFlowEditor.tsx` (~lines 303–310 and 603–606). But `view.viewport.from` is CodeMirror's virtualized range start, not the currently scrolled-to position — for a small doc `viewport.from` stays at 0 regardless of `scrollDOM.scrollTop`. Reproduced live: after `document.querySelector('.cm-scroller').scrollTop = 2000` on the starter document, `.mf-outline-item-active` remained on "Welcome to MarkFlow". On initial load the active outline item was the LAST heading ("Footnote") while `scrollTop` was 0 — symptom of an initial cursor/viewport value past the last heading. Fix should derive the active anchor from the topmost visible line, e.g. `view.posAtCoords({x: 0, y: view.documentTop})` or the line at `view.scrollDOM.scrollTop`, not `view.viewport.from`.
  
  ## Update 2026-04-17
  - Implemented in `packages/editor/src/App.tsx`:
    - tracks whether the active outline anchor source is the cursor (explicit selection/navigation) or viewport (scroll),
    - preserves the cursor-driven behavior by default and when switching tabs,
    - recomputes the active outline anchor from the selected source.
  - Implemented in `packages/editor/src/editor/MarkFlowEditor.tsx`:
    - reports viewport updates from the top visible editor position (`view.posAtCoords(...)`) instead of `view.viewport.from`.
  - Added/updated regression coverage in:
    - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx` (`viewport callback reports top visible position`),
    - `packages/editor/src/__tests__/App.test.tsx` (`scrolling view updates outline active heading`).
  - Required automated verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Manual verification remains pending in this environment because no trusted desktop UI session was available for this cycle; `passes` remains false and `lastVerifiedAt` unchanged until manual scroll-sync check is completed.
steps:
  1. Open any document with multiple heading levels.
  2. Confirm the outline panel updates as headings are added or removed.
  3. Click a heading in the panel and confirm the editor scrolls to that heading.
  4. Scroll the editor and confirm the active heading in the panel tracks the viewport.
automated verification:
  - pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts
manual verification:
  - Manual scroll-sync check with a multi-section document.

recommended loop:
1. ./harness/init.sh --smoke
2. implement one feature only
3. run targeted verification
4. update harness/feature-ledger.json and harness/progress.md
5. commit the session in a clean state.
  - Ran [harness] Repo: /Users/pprp/Workspace/MarkFlow

> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation

> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/editor test:run$ vitest run
packages/desktop test:run$ vitest run --passWithNoTests
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 7ms
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 16ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 4ms
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 2ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 6ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 14ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 18ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 91ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 181ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:09
packages/desktop test:run:    Duration  741ms (transform 630ms, setup 0ms, collect 1.49s, tests 339ms, environment 2ms, prepare 767ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 42ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 72ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 44ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 105ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 109ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 140ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 73ms
packages/editor test:run: (node:32807) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 71ms
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 7ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 78ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 97ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 86ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 63ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 100ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 52ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 47ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 503ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 341ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 177ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 55ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 64ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 148ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1886ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 628ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 639ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 53ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 30ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 234ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 38ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 154ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 18ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 72ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 123ms
packages/editor test:run: (node:32908) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 2ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 5ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5100ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 437ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 645ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 405ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:09
packages/editor test:run:    Duration  6.56s (transform 1.02s, setup 1.67s, collect 4.69s, tests 10.07s, environment 10.26s, prepare 1.91s)
packages/editor test:run: Done.
  - Ran the feature verification command:
    - 
> @markflow/editor@0.1.0 test:run /Users/pprp/Workspace/MarkFlow/packages/editor
> vitest run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts


 RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor

 ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 73ms
 ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 56ms
 ✓ src/editor/__tests__/indexer.test.ts (19 tests) 103ms
 ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 94ms
 ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 50ms
 ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 174ms
 ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 83ms
 ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 4ms
 ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 70ms
 ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 54ms
 ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 78ms
 ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 56ms
 ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 68ms
 ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 61ms
 ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 40ms
 ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 35ms
 ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 130ms
 ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 48ms
 ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 160ms
 ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 548ms
   ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 401ms
 ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 63ms
 ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 4ms
 ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 69ms
 ✓ src/export/htmlExport.test.ts (3 tests) 45ms
 ✓ src/editor/__tests__/folding.test.tsx (3 tests) 137ms
 ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 62ms
 ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1895ms
   ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 608ms
   ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 659ms
 ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 232ms
 ✓ src/components/commandPalette.test.tsx (3 tests) 31ms
 ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 130ms
 ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 53ms
 ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 54ms
 ✓ src/editor/__tests__/outline.test.ts (5 tests) 9ms
 ✓ src/components/minimap.test.tsx (4 tests) 60ms
 ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 140ms
 ✓ src/__tests__/headingNumbering.test.ts (2 tests) 3ms
 ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 12ms
 ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
 ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
 ✓ src/__tests__/App.test.tsx (57 tests) 5034ms
   ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 402ms
   ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 648ms
   ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 407ms

 Test Files  40 passed (40)
      Tests  451 passed | 3 skipped (454)
   Start at  21:52:16
   Duration  6.17s (transform 1.05s, setup 1.53s, collect 4.97s, tests 10.03s, environment 9.15s, prepare 1.77s)
  - Ran 
> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation.
  - No editor source changes were required in this pass; MF-051 behavior and regression coverage are already present in-tree.
- Verification:
  - 
> markflow@0.1.0 harness:start /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/start-session.mjs

MarkFlow harness session start
repo: /Users/pprp/Workspace/MarkFlow
branch: main

features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0

recent git log:
76203bd Preserve MF-051 protocol truthfulness while manual scroll-sync remains blocked
5264898 Preserve MF-051 protocol truthfulness while manual scroll-sync is blocked
c9939ce Defer MF-051 completion until trusted manual scroll-sync proof is available
342efb3 Close MF-051 session loop with truthful verification state and progress evidence
044ab4b Preserve MF-051 verification truthfulness with protocol-compliant session logging

latest progress entry:
### 2026-04-17 - MF-051 loop rerun (automation-only, manual scroll-sync blocked)

- Author: Codex
- Focus: one-feature protocol completion for `MF-051` in this session.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran `MF-051` automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Did not modify source or implementation files for the feature; no new code changes required in this round.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed.
  - MF-051 automation passed: `40` test files, `451` tests passed, `3` skipped.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop verification for MF-051 active outline scrolling sync (scroll a multi-section document and confirm the active heading follows viewport) cannot be executed in this environment.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` and complete trusted manual scroll-sync verification, then promote `status`, `passes`, `lastVerifiedAt` only after real proof.

next recommended feature:
MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation
status: ready | priority: 2 | area: @markflow/editor
depends on: MF-050
notes:
  Implemented on 2026-04-15 in `packages/editor/src/App.tsx` and `packages/editor/src/editor/MarkFlowEditor.tsx` by sourcing outline entries from the background symbol table, keeping heading additions/renames asynchronous, and combining explicit navigation intent with editor scroll events so the active outline item tracks the current section without blocking on full-document reparses. Automated coverage in `src/__tests__/App.test.tsx`, `src/editor/__tests__/MarkFlowEditor.test.tsx`, and `src/editor/__tests__/outline.test.ts` passed on 2026-04-15 with the listed editor test command. `passes` remains false because the manual desktop scroll-sync check is still pending. BUG (found 2026-04-16, detailed live-preview test, starter document): The active-heading indicator does NOT track scroll when the document fits the rendered viewport. `activeOutlineAnchor` is computed from `activeTab.cursorPosition ?? activeTab.viewportPosition ?? 0` (App.tsx ~line 1592), and `viewportPosition` is fed by `update.view.viewport.from` / `view.scrollDOM scroll handler` in `MarkFlowEditor.tsx` (~lines 303–310 and 603–606). But `view.viewport.from` is CodeMirror's virtualized range start, not the currently scrolled-to position — for a small doc `viewport.from` stays at 0 regardless of `scrollDOM.scrollTop`. Reproduced live: after `document.querySelector('.cm-scroller').scrollTop = 2000` on the starter document, `.mf-outline-item-active` remained on "Welcome to MarkFlow". On initial load the active outline item was the LAST heading ("Footnote") while `scrollTop` was 0 — symptom of an initial cursor/viewport value past the last heading. Fix should derive the active anchor from the topmost visible line, e.g. `view.posAtCoords({x: 0, y: view.documentTop})` or the line at `view.scrollDOM.scrollTop`, not `view.viewport.from`.
  
  ## Update 2026-04-17
  - Implemented in `packages/editor/src/App.tsx`:
    - tracks whether the active outline anchor source is the cursor (explicit selection/navigation) or viewport (scroll),
    - preserves the cursor-driven behavior by default and when switching tabs,
    - recomputes the active outline anchor from the selected source.
  - Implemented in `packages/editor/src/editor/MarkFlowEditor.tsx`:
    - reports viewport updates from the top visible editor position (`view.posAtCoords(...)`) instead of `view.viewport.from`.
  - Added/updated regression coverage in:
    - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx` (`viewport callback reports top visible position`),
    - `packages/editor/src/__tests__/App.test.tsx` (`scrolling view updates outline active heading`).
  - Required automated verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Manual verification remains pending in this environment because no trusted desktop UI session was available for this cycle; `passes` remains false and `lastVerifiedAt` unchanged until manual scroll-sync check is completed.
steps:
  1. Open any document with multiple heading levels.
  2. Confirm the outline panel updates as headings are added or removed.
  3. Click a heading in the panel and confirm the editor scrolls to that heading.
  4. Scroll the editor and confirm the active heading in the panel tracks the viewport.
automated verification:
  - pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts
manual verification:
  - Manual scroll-sync check with a multi-section document.

recommended loop:
1. ./harness/init.sh --smoke
2. implement one feature only
3. run targeted verification
4. update harness/feature-ledger.json and harness/progress.md
5. commit the session in a clean state: pass.
  - [harness] Repo: /Users/pprp/Workspace/MarkFlow

> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation

> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/desktop test:run$ vitest run --passWithNoTests
packages/editor test:run$ vitest run
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 16ms
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 5ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 7ms
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 4ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 2ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 10ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 13ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 117ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 184ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:23
packages/desktop test:run:    Duration  617ms (transform 260ms, setup 0ms, collect 818ms, tests 356ms, environment 1ms, prepare 726ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 46ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 90ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 104ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 55ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 157ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 111ms
packages/editor test:run: (node:33204) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 103ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 64ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 69ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 83ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 39ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 86ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 80ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 484ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 345ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 143ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 2ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 38ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 44ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1868ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 492ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 717ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 48ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 171ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 32ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 232ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 59ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 12ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 196ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 122ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 72ms
packages/editor test:run: (node:33303) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 1ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 6ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5139ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 430ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 651ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 405ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:24
packages/editor test:run:    Duration  6.56s (transform 1.03s, setup 1.57s, collect 4.86s, tests 10.10s, environment 10.06s, prepare 2.11s)
packages/editor test:run: Done: pass (invokes full 
> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/desktop test:run$ vitest run --passWithNoTests
packages/editor test:run$ vitest run
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 4ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 8ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 187ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 6ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 4ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 16ms
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 13ms
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 19ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 89ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:31
packages/desktop test:run:    Duration  628ms (transform 364ms, setup 0ms, collect 1.09s, tests 347ms, environment 1ms, prepare 835ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 93ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 95ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 151ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 104ms
packages/editor test:run: (node:33409) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 6ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 79ms
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 109ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 94ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 63ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 62ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 82ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 135ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 165ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 625ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 459ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 34ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 10ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 74ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 65ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 31ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 147ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 2061ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 666ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 767ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 59ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 67ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 34ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 261ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 146ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 11ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 126ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 5ms
packages/editor test:run: (node:33513) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 3ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 13ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 5ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5242ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 459ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 647ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 397ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:31
packages/editor test:run:    Duration  6.68s (transform 994ms, setup 1.60s, collect 5.07s, tests 10.64s, environment 10.41s, prepare 1.86s)
packages/editor test:run: Done).
  - feature command: pass ( test files,  tests,  skipped).
  - 
> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation: pass ().
- Risks / blocker:
  - Trusted manual desktop scroll-sync verification for MF-051 is still not possible in this environment, so  cannot be marked true.
  - During full-suite test runs,  logs permission-related  stderr entries; they are environmental and did not fail tests.
- Ledger handling:
  - Kept  unchanged for  (, , ) to maintain truthfulness while manual verification is pending.
- Next recommended feature:
  - Continue  by completing trusted multi-section manual outline scroll-sync validation, then update  only after passing both automation and manual checks.

## 2026-04-19 - Aggressive bundle layout overhaul

- Summary:
  - Merged recent items and outline navigation into the left bundle rail in `packages/editor/src/components/VaultSidebar.tsx` and wired the rail from `packages/editor/src/App.tsx`.
  - Introduced a shared overlay shell in `packages/editor/src/components/OverlayScreen.tsx` and aligned Quick Open, Command Palette, Global Search, and Go To Line around the same header/body/footer structure.
  - Refreshed the starter document marketing surface in `packages/editor/src/app-shell/documents.ts` so the first-run experience speaks the new editorial bundle language and still exposes an early external link for link rendering coverage.
- Tests added or updated:
  - Added `packages/editor/src/components/QuickOpen.test.tsx`.
  - Expanded `packages/editor/src/components/VaultSidebar.test.tsx`, `packages/editor/src/components/commandPalette.test.tsx`, and `packages/editor/src/__tests__/App.test.tsx` to cover merged-rail and overlay-shell behavior.
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/components/VaultSidebar.test.tsx src/components/commandPalette.test.tsx src/components/QuickOpen.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor test:run`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
- Remaining risks:
  - There is no standalone docs/marketing site in this repo today, so the docs/marketing refresh in this pass is limited to the in-app starter surface.
  - The workspace already contains unrelated dirty changes in package manifests, desktop build artifacts, and `global.css`; this handoff does not normalize or revert them.
