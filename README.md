# MarkFlow

> **Markdown that gets out of your way.**

*Write in flow, publish anywhere.*

MarkFlow is a WYSIWYG markdown editor that makes the syntax invisible — not by hiding it in a separate preview pane, but by erasing it **right where you type**. Move your cursor away from a heading and the `##` disappears. Bold text looks bold. Links look like links. You stay in one document, in one mode, always.

No split panes. No preview lag. No mode-switching. Just writing.

![CI](https://github.com/pprp/MarkFlow/actions/workflows/ci.yml/badge.svg)

---

## Why MarkFlow?

| Pain point | Other editors | MarkFlow |
|---|---|---|
| Markdown clutter | Syntax always visible | Syntax hides on blur |
| Split-pane distraction | Side-by-side source + preview | Single unified canvas |
| Context switching | Toggle between two modes | One continuous writing flow |
| Export lock-in | Proprietary formats | Plain `.md` — works everywhere |
| Heavy Electron apps | 200 MB+ installers | Lean build, fast startup |

MarkFlow borrows Typora's core idea — the illusion that markdown doesn't exist — and builds it on **CodeMirror 6's inline decoration API**, giving you a hackable, open foundation instead of a black box.

---

## Features

- **Inline WYSIWYG** — syntax hides as your cursor moves away; no separate preview pane
- **Source toggle** — reveal the raw markdown instantly with `Ctrl+/`
- **Rich decorations** — headings, bold, italic, code, links, images, blockquotes, task lists all render in-place
- **Syntax-highlighted code blocks** — fenced blocks with language label
- **Floating toolbar** — bold, italic, strikethrough, code, link actions on text selection
- **Smart input** — auto-pairs for `*`, `_`, `` ` ``, `[`; auto-continues list items on Enter
- **File open / save** — native file dialogs via Electron
- **Desktop app** — macOS `.dmg` built with Electron

---

## Tech Stack

| Layer | Choice |
|---|---|
| Editor engine | CodeMirror 6 (inline decoration API) |
| UI framework | React 18 + Vite |
| Desktop shell | Electron |
| Monorepo | pnpm workspaces |
| Language | TypeScript (strict) |
| Tests | Vitest |
| Linting | ESLint + Prettier |

---

## Packages

```
packages/
  editor/    # React/Vite web editor (deployable standalone)
  desktop/   # Electron main + preload wrapper
  shared/    # Shared TypeScript types
```

---

## Getting Started

**Prerequisites:** Node 22+, pnpm 9+

```bash
# Install dependencies
pnpm install

# Run the web editor in the browser
pnpm dev

# Run the Electron desktop app
pnpm desktop

# Run tests
pnpm test

# Build everything
pnpm build
```

---

## Roadmap

### Phase 1 — Core Editor (current)
- [x] CodeMirror 6 with inline WYSIWYG decorations
- [x] Source ↔ WYSIWYG toggle
- [x] Headings, bold, italic, inline code, links, images
- [x] Fenced code blocks with syntax highlighting
- [x] Blockquotes, task lists, horizontal rules
- [x] Floating selection toolbar
- [x] Smart input (auto-pairs, list continuation)
- [x] File open / save via Electron
- [ ] Export to PDF, HTML

### Phase 2 — Polish
- [ ] Theme engine (CSS variables + hot-reload)
- [ ] Tables and math (KaTeX)
- [ ] Focus / typewriter mode
- [ ] Community themes

### Phase 3 — Extensibility
- [ ] Plugin API (`registerMarkdownPostProcessor`)
- [ ] Block renderers (Excalidraw, code execution)
- [ ] CRDT collaboration via Yjs (opt-in)

---

## Contributing

1. Fork the repo and create a branch from `main`
2. Run `pnpm install && pnpm test` to confirm everything passes
3. Make your changes with tests
4. Open a pull request — CI will lint, test, and build automatically

## License

MIT
