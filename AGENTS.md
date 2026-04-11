# MarkFlow

*Write in flow, publish anywhere.*

A Typora-like WYSIWYG markdown editor that hides source markup on render, built on CodeMirror 6.

## Project Overview

MarkFlow replicates Typora's core value — the illusion that markdown doesn't exist. You write, and rich text appears. The source-hides-on-render WYSIWYG toggle is the centerpiece.

### Target Users
- Academics, engineers, and technical writers

### Tech Stack
- **Editor engine**: CodeMirror 6 (inline decoration API for WYSIWYG illusion)
- **Collaboration**: Yjs (CRDT, opt-in)
- **Desktop**: Electron (or Tauri for lighter builds)
- **Theming**: Plain CSS + hot-reload watcher
- **Plugin API**: `registerMarkdownPostProcessor`-style interface (inspired by Obsidian)

## Development Phases

### Phase 1 — Core Editor (MVP)
- CodeMirror 6 integration with inline decorations
- WYSIWYG toggle (source ↔ rendered)
- Basic markdown support: headings, bold, italic, links, images, code blocks
- File open/save
- Ship to GitHub early, dogfood immediately

### Phase 2 — User Acquisition Features
- Theme engine (CSS + hot-reload watcher)
- Export pipeline (PDF, HTML, DOCX)
- Tables, math (KaTeX/MathJax), focus mode
- Community theme support

### Phase 3 — Extensibility
- Plugin API (`registerMarkdownPostProcessor`)
- Block renderers (Desmos, code execution, Excalidraw embeds)

### Phase 4 — Governance & Sustainability
- Monthly release cadence
- Public RFC process for breaking changes
- Beta builds on every `main` merge via GitHub Actions with auto-update

## Development Commands

```bash
pnpm install
pnpm dev
pnpm desktop
pnpm build
pnpm test
pnpm test:watch
pnpm harness:start
pnpm harness:next
pnpm harness:verify
./harness/init.sh --smoke
```

## Code Conventions

- TypeScript throughout
- ESM modules
- Prettier for formatting
- ESLint for linting
- Tests with Vitest

## Harness Workflow

1. Run `pnpm harness:start` at the beginning of a session to read the repo state, git log, progress file, and next feature.
2. Run `./harness/init.sh --smoke` before implementing a new feature.
3. Work on one feature at a time from `harness/feature-ledger.json`.
4. Only mark `passes` as `true` after the listed verification steps succeed.
5. Append a concise handoff to `harness/progress.md` before ending the session.
