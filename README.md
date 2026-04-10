# MarkFlow

> Write in flow, publish anywhere.

A Typora-inspired WYSIWYG markdown editor built on CodeMirror 6. Markdown syntax hides as you type — you see rich text, not markup.

![CI](https://github.com/pprp/MarkFlow/actions/workflows/ci.yml/badge.svg)

---

## Features

- **WYSIWYG editing** — markdown syntax hides when your cursor moves away
- **Inline decorations** — headings, bold, italic, code, links, blockquotes, task lists all render in-place
- **Source toggle** — switch between rendered and raw markdown at any time (`Ctrl+/`)
- **Smart input** — auto-pairs for `*`, `_`, `` ` ``, `[`, auto-continues list items on Enter
- **Code blocks** — syntax-highlighted fenced blocks with language label
- **Floating toolbar** — bold, italic, strikethrough, code, link actions appear on text selection
- **File open / save** — native file dialogs via Electron
- **Desktop app** — macOS `.dmg` built with Electron, native window chrome

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

## Packages

```
packages/
  editor/    # React/Vite web editor (deployable standalone)
  desktop/   # Electron main + preload wrapper
  shared/    # Shared TypeScript types
```

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

## Contributing

1. Fork the repo and create a branch from `main`
2. Run `pnpm install && pnpm test` to confirm everything passes
3. Make your changes with tests
4. Open a pull request — CI will lint, test, and build automatically

## License

MIT
