# MarkFlow Project Spec for Long-Running Agents

## Product Thesis

MarkFlow should feel like markdown is invisible while keeping markdown's portability intact. The editor must preserve source fidelity while rendering headings, emphasis, links, code blocks, and richer block types as if the user were editing rich text directly.

## Current Repository Shape

- `packages/editor`: React + CodeMirror 6 editor surface and unit tests
- `packages/desktop`: Electron shell, file dialogs, and desktop integration
- `packages/shared`: shared types such as `ViewMode`
- root scripts: workspace orchestration, harness entrypoints, cross-package tests

## Current Constraints

- This repo is still in Phase 1 / early Phase 2 territory.
- The editor already has inline decoration logic and tests for several markdown affordances.
- Desktop file operations exist in the Electron main process, but the renderer side still needs stronger integration and verification.
- There is not yet a browser automation suite, so the harness relies on schema validation, unit tests, and manual smoke steps.

## Non-Negotiables

- Never lose user text when switching modes, opening files, or saving documents.
- Preserve markdown source fidelity: rendered affordances must not mutate the canonical text unexpectedly.
- Prefer incremental changes over broad rewrites.
- Every session should end in a clean handoff with verification notes.

## MVP User Journeys

### Editing

1. A user opens MarkFlow and sees a helpful starter document.
2. The user types markdown naturally.
3. Markdown syntax hides when the caret leaves a rendered region.
4. The user can switch between WYSIWYG and source views without losing content or cursor context.

### File Management

1. A user opens an existing markdown file from Finder, Explorer, or the File menu.
2. The editor reflects the opened file contents immediately.
3. Save and Save As write the current editor buffer.
4. Window title and represented filename stay in sync with the active document.

### Desktop Shell

1. External links open in the system browser.
2. The app blocks accidental navigation away from the editor surface.
3. The packaged desktop app is the primary dogfooding target.

## Phase Backlog

### Phase 1

- stabilize WYSIWYG decorations
- preserve editor state across mode changes
- wire desktop file operations to the renderer
- cover the highest-risk editing behaviors with automated tests

### Phase 2

- theme engine with CSS hot reload
- export pipeline
- tables, math, and focus mode

### Phase 3

- plugin hooks modeled after `registerMarkdownPostProcessor`
- block renderers for richer embeds
- optional Yjs collaboration

### Phase 4

- release automation and governance workflows
- beta artifacts on every `main` merge

## Clean Session Definition

A session is clean only when:

1. the touched feature is either verified or clearly left in a recoverable partial state
2. relevant automated checks pass
3. `harness/feature-ledger.json` reflects reality
4. `harness/progress.md` explains what changed, what was verified, and what should happen next

## Current Recommended Next Target

`MF-005` is the highest-priority open feature because list and blockquote decorations already exist in the codebase but still lack direct verification. Tightening those render/edit transitions will reduce regressions in the remaining Phase 1 WYSIWYG surface.
