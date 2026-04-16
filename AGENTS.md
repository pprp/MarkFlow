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

## UI Design Aesthetic (Frozen Apr 2026)

### Design Direction: "Refined Editorial"
Warm minimalism with intentional typography and color. Replaces Apple's cool modernism with editorial sophistication fit for academic/technical audiences.

### Typography System
- **UI Font**: DM Sans (sans-serif, modern and clean)
- **Display Font**: DM Serif Display (serifs for H1/H2 headings — editorial authority)
- **Code Font**: JetBrains Mono (monospace, technical accuracy)

### Color Palette
- **Accent Color**: `#C47625` (light mode) / `#D4903A` (dark mode) — warm amber instead of Apple blue
- **Background**: `#FAFAF8` (light mode) / `#1B1A18` (dark mode) — warm off-white instead of pure white
- **Subtle Accent**: `--mf-accent-subtle` for hover/focus states (75% opacity)
- **Elevated Surface**: `--mf-bg-elevated` for cards/panels (1px border, soft shadow)

### Component Sizing & Spacing
- **Title Bar**: 48px height, no vibrancy blur, clean neutral background
- **Tab Strip**: Refined pill buttons, close buttons hidden until hover, 2px border-radius
- **Sidebar**: 240px width, 6px item padding, focus ring on interactions
- **Status Bar**: 28px height, tabular-nums for line numbers
- **Modals**: 16px border-radius, appear animation, warm focus rings
- **Scrollbars**: Warm accent on hover, subtle in idle state

### Animation & Interaction
- **Transitions**: `cubic-bezier(0.4, 0, 0.2, 1)` for natural easing
- **Duration**: 150ms for quick feedback, 250ms for important modals
- **Focus State**: Warm accent ring (2px solid `var(--mf-accent)`)
- **Hover State**: Subtle background lift with soft shadow on elevated surfaces

### Design Principles
1. **Typography First**: DM Display for headings creates editorial authority vs utilitarian sans
2. **Warmth Over Sterility**: Amber accent + cream backgrounds project approachability vs Apple's cool blue
3. **Intentional Spacing**: 6px, 12px, 16px increments (never random padding)
4. **Frosted Glass**: Modals use translucent backdrop with frosted glass effect
5. **Hidden Until Needed**: Close buttons, subtle UI chrome appear on interaction (e.g., close ✕ on tab hover)

### Files Modified in This Redesign
- `packages/editor/index.html` — Font imports (DM Sans, DM Serif Display, JetBrains Mono)
- `packages/editor/src/styles/global.css` — Complete design token overhaul (1684 lines)
- `packages/editor/src/components/*.css` — All component styles (VaultSidebar, FloatingToolbar, CommandPalette, GlobalSearch, GoToLine, QuickOpen)
- `packages/editor/src/App.tsx` — Logo refinement, label updates, menu action handlers
- `packages/desktop/src/main/menu.ts` — Expanded Electron menus (File, Edit, Format, Insert, View, Go, Develop + Window)
- `packages/shared/src/index.ts` — New MarkFlowMenuAction types for all format/insert/toggle actions
