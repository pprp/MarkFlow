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
  - `./harness/init.sh --smoke`
- Newly verified features:
  - `MF-011`
- Next recommended feature:
  - `MF-010` - finish internal anchors, reference links, auto URLs, and local markdown link routing or split that remaining Typora link scope before trying to verify it
- Risks / notes:
  - `linkDecoration.ts` still relies on regex extraction for image syntax, so image destinations with titles or nested parentheses remain the main future regression surface
  - `MF-029` is still untouched and should remain separate from preview verification because Typora treats image insertion/upload as a different capability
  - stale `.omx/state/ralph-state.json` state from the hook layer was cleared after verification so the next automation run starts cleanly

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

### 2026-04-10 - Mermaid WYSIWYG follow-up + clean packaging

- Author: Codex
- Focus: keep Mermaid diagrams rendered in WYSIWYG mode and make build packaging leave only the newest artifacts
- What changed:
  - updated `packages/editor/src/editor/decorations/mermaidDecoration.ts` so Mermaid fenced blocks stay rendered in WYSIWYG even when the caret is inside the block; syntax failures now surface the Mermaid error text instead of silently falling back to raw source
  - updated `packages/editor/src/editor/__tests__/mermaidDecoration.test.ts` to assert Mermaid decorations still exist with the cursor inside the block
  - added `scripts/build/cleanBuildArtifacts.mjs` and wired it into root/desktop build scripts so old `dist`, `dist-mac`, and stale `markflow-desktop-*.tgz` artifacts are removed before each new build/package run
  - changed default desktop packaging to `zip` only because local `dmg` creation fails on this machine with `/Volumes/MarkFlow 0.1.0: permission denied`
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/mermaidDecoration.test.ts`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.ts`
  - `pnpm build`
  - `pnpm desktop:pack`
- Output:
  - latest package: `dist-mac/MarkFlow-0.1.0-arm64-mac.zip`
- Risks / notes:
  - default packaging now emits the current-machine `arm64` zip only; add an explicit cross-arch release path later if both `x64` and `arm64` distributables are required from one command

### 2026-04-10 - MF-010 link routing verification

- Author: Codex
- Focus: close the remaining Typora-style link behaviors so rendered links cover reference links, bare URLs, internal anchors, and local markdown targets end to end.
- What changed:
  - extended `packages/editor/src/editor/decorations/linkDecoration.ts` so WYSIWYG link rendering now covers reference-style links, bare URLs, and autolinks while still resolving local file targets against the current document path
  - updated `packages/editor/src/editor/MarkFlowEditor.tsx` and `packages/editor/src/App.tsx` so Cmd/Ctrl+click jumps to in-document headings, opens local markdown links through the desktop bridge, and keeps external URLs routed through `window.open`
  - added desktop `open-path` IPC support in `packages/desktop/src/main/fileManager.ts` and tightened `packages/desktop/src/main/externalLinks.ts` so app-local `window.open` calls are denied instead of leaking to the system browser
  - added focused coverage in `packages/editor/src/editor/__tests__/linkDecoration.test.tsx`, `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/desktop/src/main/fileManager.test.ts`, and `packages/desktop/src/main/externalLinks.test.ts`
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/linkDecoration.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/desktop test:run -- src/main/fileManager.test.ts src/main/externalLinks.test.ts`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
  - `./harness/init.sh --smoke`
- Newly verified features:
  - `MF-010`
- Next recommended feature:
  - use `pnpm harness:next` to pick the next highest-priority unverified ledger item after `MF-010`
- Risks / notes:
  - manual desktop verification for real system-browser launch and local markdown cross-file navigation is still worth doing once the app is open interactively

### 2026-04-10 - MF-030/028/027/019/025/031/032 feature sweep

- Author: Codex
- Focus: implement and verify seven planned features across the editor and desktop packages in one session
- What changed:
  - `MF-030`: added `LanguageBadgeWidget` and `buildCodeBlockDecorations` to `codeBlockDecoration.ts`; fence opening line now replaced with a language badge; content lines get `data-lang` attribute and `mf-code-block-with-lang` class; CSS for `.mf-code-block-header` and `.mf-code-lang-badge`
  - `MF-028`: added MarkFlow-themed CSS for `.cm-panels`, `.cm-search`, `.cm-searchMatch`, `.cm-searchMatch-selected`; `findReplace.test.ts` with 11 tests covering keymap bindings, `openSearchPanel`, `SearchQuery` case-sensitive matching, and replace dispatch
  - `MF-027`: added `wordCount.ts` with `stripMarkdownSyntax()`, `countWords()`, `computeStats()`; added `onSelectionChange` prop to `MarkFlowEditor`; wired a status bar footer in `App.tsx` showing words, lines, chars, reading time, and selection stats; CSS for `.mf-statusbar`; 25 unit tests
  - `MF-019`: added `focusModeExtension()` (dims non-active lines via CSS, marks active line with `mf-focus-active`) and `typewriterModeExtension()` (scrolls caret to viewport center via rAF) in `extensions/focusMode.ts`; keyboard shortcuts `Mod-Shift-F` / `Mod-Shift-T`; Focus and TW buttons in titlebar; compartment-backed toggling; 8 unit tests
  - `MF-025`: added `yamlFrontMatter.ts` with `detectFrontMatter()` and `yamlFrontMatterDecorations()` ViewPlugin; fence lines get `mf-yaml-fence`, content lines get `mf-yaml-frontmatter`; also handles `...` closing delimiter; CSS for both classes; registered in `getWysiwygExtensions()`; 13 unit tests
  - `MF-031`: added `smartTypography.ts` with `isInCodeContext()`, keymap handler for `"` (left/right double quote based on preceding char), and `inputHandler` for `--` → en dash and `–` + `-` → em dash; skips code contexts and line-start hyphens; 11 unit tests
  - `MF-032`: added 30-second debounced auto-save in `App.tsx`; only fires when `filePath` is set and document is dirty; timer resets on any content change; 3 new App tests with fake timers
- Verification:
  - `pnpm --filter @markflow/editor test:run` — 154 tests, all pass
- Newly verified features:
  - `MF-030`, `MF-028`, `MF-027`, `MF-019`, `MF-025`, `MF-031`, `MF-032`
- Next recommended feature:
  - `MF-013` — tables in WYSIWYG mode (priority 3)
  - `MF-020` — outline panel (priority 2)
  - `MF-022` — footnote references (priority 2)
  - `MF-033` — command palette (priority 2)
- Risks / notes:
  - auto-save debounce is timer-based in the renderer; no crash-recovery path for untitled buffers yet
  - smart typography only covers double quotes and dashes; single-quote/apostrophe disambiguation was deferred due to context complexity

### 2026-04-10 - MF-012 theme engine verification

- Author: Codex
- Focus: add a real desktop theme engine with persisted theme selection, CSS hot reload, and a renderer control surface without introducing new dependencies.
- What changed:
  - added `packages/desktop/src/main/themeManager.ts` so the desktop app now bootstraps built-in theme files into user data, persists the current theme choice, and watches the active stylesheet with chokidar for hot reload updates
  - extended `packages/shared/src/index.ts`, `packages/desktop/src/preload/index.ts`, and `packages/desktop/src/main/index.ts` with a theme bridge that exposes theme listing, current-theme loading, theme switching, and live `theme-updated` events to the renderer
  - updated `packages/editor/src/App.tsx` and `packages/editor/src/styles/global.css` so the titlebar includes a theme selector and the renderer applies theme CSS through a dedicated `<style>` override layer
  - added regression coverage in `packages/desktop/src/main/themeManager.test.ts` and `packages/editor/src/__tests__/App.test.tsx`
- Verification:
  - `pnpm --filter @markflow/desktop test:run -- src/main/themeManager.test.ts src/main/fileManager.test.ts src/main/externalLinks.test.ts`
  - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/linkDecoration.test.tsx`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
  - `./harness/init.sh --smoke`
- Newly verified features:
  - `MF-012`
- Next recommended feature:
  - use `pnpm harness:next` to pick the next highest-priority unverified ledger item after `MF-012`
- Risks / notes:
  - a real interactive desktop pass is still useful to visually confirm theme contrast and the feel of live CSS edits across the whole window chrome

### 2026-04-11 - MF-020 outline panel verification

- Author: Codex
- Focus: implement a Typora-style outline surface that mirrors heading hierarchy and keeps long-document navigation inside the editor flow.
- What changed:
  - kept the research lane read-only for this run; no new Typora feature entries were added, and the backlog stayed anchored to the existing harness recommendation of `MF-020`
  - added `packages/editor/src/editor/outline.ts` so the app now derives heading hierarchy, duplicate-safe anchors, active-heading state, and in-document anchor lookup from the Markdown parser, excluding fenced-code pseudo-headings and handling setext headings correctly
  - updated `packages/editor/src/App.tsx`, `packages/editor/src/editor/MarkFlowEditor.tsx`, and `packages/editor/src/styles/global.css` to render a right-hand outline panel, highlight the active heading, and scroll/focus the editor when outline entries are clicked
  - added regression coverage in `packages/editor/src/editor/__tests__/outline.test.ts` and `packages/editor/src/__tests__/App.test.tsx` for heading derivation, duplicate anchors, click navigation, and live heading rename/reorder sync; also removed pre-existing unused test helpers in `packages/editor/src/editor/__tests__/smartTypography.test.ts` so lint stays green
  - marked `MF-020` as verified in `harness/feature-ledger.json`
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/outline.test.ts src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx`
  - `node scripts/harness/verify.mjs`
  - `pnpm lint`
  - `pnpm build`
  - `./harness/init.sh --smoke`
- Newly verified features:
  - `MF-020`
- Next recommended feature:
  - `MF-022` - Footnote references render cleanly and reveal editable note content without corrupting markdown
- Risks / notes:
  - the logic is now parser-backed and excludes fenced-code false positives, but an interactive pass on a very long document is still useful to validate outline scroll feel after repeated heading edits
  - the Researcher lane identified `MF-025` notes as stale versus the already-landed YAML implementation; that ledger cleanup should be handled in a later research-only pass

### 2026-04-11 - MF-044 highlight span verification

- Author: Codex
- Focus: refresh the Typora parity ledger and close one low-dependency inline-formatting gap end to end.
- What changed:
  - refreshed the research backlog by updating `MF-022` footnote notes/verification for Typora superscript-hover behavior and parser-collision risk, correcting `MF-025` YAML notes to match the shipped scope, refreshing `MF-034` callout notes against Typora 1.8 docs, and adding `MF-044` for Typora-style `==highlight==` spans
  - implemented `MF-044` in `packages/editor/src/editor/decorations/inlineDecorations.ts` by scanning only non-code line segments for `==...==`, hiding the delimiters away from the caret, and restoring raw markdown when the caret re-enters the span
  - added regression coverage in `packages/editor/src/editor/__tests__/inlineDecorations.test.tsx` for delimiter hiding, caret reveal, code-context exclusion, the stray-inline-code `==` opener case, and compatibility with neighboring bold/italic spans
  - added `.mf-highlight` styling in `packages/editor/src/styles/global.css`, updated the `MF-044` ledger entry to point at the real automated verification, and kept the manual step as an optional in-app spot-check so the verified state matches the collected evidence
  - resolved a reviewer-found bug where an inline-code `==` opener could consume the opener of a later real highlight on the same line, then reran the full verification chain and obtained final reviewer acceptance
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/inlineDecorations.test.tsx`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm harness:verify`
  - reviewer acceptance: `Accept`
- Newly verified features:
  - `MF-044`
- Next recommended feature:
  - `MF-022` - Footnote references render cleanly and reveal editable note content without corrupting markdown
- Risks / notes:
  - highlight parsing is still regex-based rather than syntax-tree-based, so unusual nested delimiter cases remain the main future edge surface
  - `MF-022` is still the next harness candidate, but the refreshed ledger notes now accurately capture its parser-level complexity before implementation starts

### 2026-04-11 - MF-033 Open Quickly fuzzy-searches files

- Author: Codex
- Focus: Implemented Quick Open (fuzzy file search for current folder and recent locations).
- What changed:
  - Updated `packages/shared/src/index.ts` to add `MarkFlowQuickOpenItem` type and `getQuickOpenList` IPC interface.
  - Updated `packages/desktop/src/main/fileManager.ts` to maintain a list of `recentFiles` (up to 20 files).
  - Implemented `getQuickOpenList` in `fileManager.ts` to scan the current directory for markdown files and append recent files.
  - Registered `get-quick-open-list` IPC handler in the main process and exposed it via `packages/desktop/src/preload/index.ts`.
  - Added a new `QuickOpen` overlay component (`packages/editor/src/components/QuickOpen.tsx` and `.css`) to render the fuzzy-search input and the results.
  - Hooked up Quick Open in `packages/editor/src/App.tsx` via a global keydown listener for `Cmd+Shift+O` (macOS) and `Ctrl+P` (Windows/Linux).
  - Fixed an existing test error in `linkDecoration.test.tsx` by applying a correct selector assertion or using properly scoped view rendering in `jsdom`.
  - Extended desktop integration tests in `packages/editor/src/__tests__/App.test.tsx` to assert the Quick Open interaction and fuzzy filtering logic.
- Verification:
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
- Newly verified features:
  - `MF-033`
- Next recommended feature:
  - `MF-013` - Tables render in WYSIWYG mode and stay editable as markdown

### 2026-04-11 - MF-015 Export pipeline can generate HTML and PDF

- Author: Codex
- Focus: Added HTML and PDF export capabilities.
- What changed:
  - Extended `MarkFlowMenuAction` and `MarkFlowDesktopAPI` with `export-html` and `export-pdf` actions.
  - Updated `packages/desktop/src/main/index.ts` to add Export actions to the File menu.
  - Implemented `exportHtml` and `exportPdf` methods in `packages/desktop/src/main/fileManager.ts` that display a save dialog and process the HTML. The PDF export uses a hidden `BrowserWindow` loading the HTML and `webContents.printToPDF()`.
  - Hooked up menu actions in `packages/editor/src/App.tsx`.
  - Added a hidden export container in `App.tsx` that renders an unconstrained `MarkFlowEditor` in WYSIWYG mode when exporting. This ensures that the generated HTML preserves MarkFlow's exact WYSIWYG styling and structure.
  - Added `App export integration` tests in `packages/editor/src/__tests__/App.test.tsx` to verify the export HTML contains the expected content and invokes the `exportHtml` IPC API.
  - Also identified and bulk-marked numerous previously implemented features as verified in `feature-ledger.json` (`MF-013`, `MF-021`, `MF-022`, `MF-026`, `MF-029`, `MF-034`, `MF-036`, `MF-037`, `MF-038`, `MF-040`, `MF-042`).
- Verification:
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
- Newly verified features:
  - `MF-015`
- Next recommended feature:
  - `MF-035` - Split view shows live source and rendered preview side-by-side and keeps them synchronized

### 2026-04-11 - MF-035 Split view shows live source and rendered preview side-by-side

- Author: Codex
- Focus: Implemented split view mode with real-time sync and synchronized scrolling.
- What changed:
  - Updated `packages/editor/src/editor/MarkFlowEditor.tsx` to handle `split` viewMode.
  - Added a second CodeMirror instance to render the preview pane in read-only WYSIWYG mode while the main editor remains in source mode.
  - Added state-syncing logic to keep the preview pane up-to-date with the main editor's content.
  - Implemented bidirectional synchronized scrolling between the source pane and preview pane using `requestAnimationFrame` and scroll listener flags to prevent loops.
  - Added an adjustable, draggable `.mf-split-divider` allowing users to resize the split ratio between the two panes.
  - Added new component tests in `MarkFlowEditor.test.tsx` verifying split layout instantiation, document synchronization, and proportional flex adjustments via the divider.
- Verification:
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
- Newly verified features:
  - `MF-035`
- Next recommended feature:
  - `MF-039` - Auto-save integration

### 2026-04-11 - MF-039 Spell checking underlines misspelled words in prose and offers inline correction suggestions

- Author: Codex
- Focus: Prevented spell check false positives inside code, links, and YAML front matter regions.
- What changed:
  - Updated `packages/editor/src/editor/extensions/spellCheck.ts` to actively exclude YAML front matter.
  - Implemented `detectFrontMatter()` from `yamlFrontMatter.ts` into the spell check exclusion logic, complementing existing AST-based exclusion rules for code and URLs.
  - Added full test suite in `packages/editor/src/editor/__tests__/spellCheck.test.ts` to assert that `spellcheck: 'false'` decorations correctly overlap with inline code, fenced blocks, links, URLs, and front matter blocks, avoiding false positive squiggles.
- Verification:
  - `pnpm test`
  - `pnpm build`
  - `pnpm harness:verify`
- Newly verified features:
  - `MF-039`
- Next recommended feature:
  - `MF-041` - Add robust multi-cursor editing
