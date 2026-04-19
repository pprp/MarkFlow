# Aggressive Bundle Layout Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn MarkFlow's editor shell into a stronger bundle navigator by merging outline and recent navigation into the left sidebar, aligning overlay surfaces, and upgrading starter/docs surfaces.

**Architecture:** Extend the existing `VaultSidebar` into a richer left-rail navigator, source recent/pinned entries from the existing quick-open bridge, and unify overlay chrome with a small shared editor component plus shared CSS tokens. Keep behavior centered in `App.tsx` and existing bridge/data contracts so the change stays local and reversible.

**Tech Stack:** React, TypeScript, CodeMirror 6, Vitest, plain CSS, existing Electron preload bridge

---

### Task 1: Lock the bundle sidebar behavior with tests

**Files:**
- Modify: `packages/editor/src/components/VaultSidebar.test.tsx`
- Modify: `packages/editor/src/__tests__/App.test.tsx`

- [ ] **Step 1: Write the failing component tests for recent + outline sections**

```tsx
it('renders recent and outline sections and dispatches their handlers', () => {
  render(
    <VaultSidebar
      folderPath="/Users/pprp/Notes"
      files={['/Users/pprp/Notes/README.md']}
      activeFile="/Users/pprp/Notes/README.md"
      recentItems={[{ id: 'file:/recent/roadmap.md', label: 'roadmap.md', filePath: '/recent/roadmap.md', kind: 'file', isRecent: true, isPinned: false }]}
      outlineItems={[{ anchor: 'intro', from: 0, level: 1, text: 'Introduction' }]}
      activeOutlineAnchor="intro"
      onRecentSelect={onRecentSelect}
      onOutlineSelect={onOutlineSelect}
      onFileOpen={onFileOpen}
      onFileRename={onFileRename}
      onFileDelete={onFileDelete}
      onOpenFolder={onOpenFolder}
    />,
  )
})
```

- [ ] **Step 2: Run the sidebar tests to verify they fail**

Run: `pnpm --filter @markflow/editor exec vitest run src/components/VaultSidebar.test.tsx`
Expected: FAIL because `VaultSidebar` does not yet accept/render recent + outline data.

- [ ] **Step 3: Write the failing App integration test for the merged left rail**

```tsx
it('renders recent quick-open items and outline entries in the left sidebar bundle', async () => {
  api.getQuickOpenList = vi.fn(async () => [recentFile])
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Toggle file sidebar' }))
  expect(await screen.findByText('Recent')).toBeInTheDocument()
  expect(await screen.findByText('Outline')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the focused App test to verify it fails**

Run: `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx`
Expected: FAIL on missing bundle-sidebar sections or missing integrated recent/outline rendering.

### Task 2: Lock the shared overlay chrome with tests

**Files:**
- Modify: `packages/editor/src/components/commandPalette.test.tsx`
- Create or Modify: `packages/editor/src/components/OverlayScreen.test.tsx`

- [ ] **Step 1: Write the failing test for shared overlay shell metadata**

```tsx
it('renders the shared overlay header and helper content', () => {
  render(
    <OverlayScreen
      title="Open quickly"
      eyebrow="Workspace"
      description="Jump between nearby and recent documents."
    >
      <div>Body</div>
    </OverlayScreen>,
  )
})
```

- [ ] **Step 2: Run the overlay test to verify it fails**

Run: `pnpm --filter @markflow/editor exec vitest run src/components/commandPalette.test.tsx src/components/OverlayScreen.test.tsx`
Expected: FAIL because the shared overlay shell does not exist yet.

- [ ] **Step 3: Add a failing regression assertion in command palette**

```tsx
expect(screen.getByText('Command palette')).toBeInTheDocument()
expect(screen.getByText('Search commands, formats, and workspace actions')).toBeInTheDocument()
```

- [ ] **Step 4: Run the command palette tests to verify the new assertions fail**

Run: `pnpm --filter @markflow/editor exec vitest run src/components/commandPalette.test.tsx`
Expected: FAIL because the current palette does not render the shared editorial header copy.

### Task 3: Implement the bundle sidebar and starter/editorial surfaces

**Files:**
- Modify: `packages/editor/src/App.tsx`
- Modify: `packages/editor/src/app-shell/documents.ts`
- Modify: `packages/editor/src/components/VaultSidebar.tsx`
- Modify: `packages/editor/src/components/VaultSidebar.css`

- [ ] **Step 1: Extend `VaultSidebar` props for recent + outline sections**

```ts
recentItems?: MarkFlowQuickOpenItem[]
outlineItems?: OutlineHeading[]
activeOutlineAnchor?: string | null
onRecentSelect?: (item: MarkFlowQuickOpenItem) => void
onOutlineSelect?: (position: number) => void
```

- [ ] **Step 2: Implement the left-rail sections with minimal new structure**

```tsx
<section className="mf-bundle-section">
  <header className="mf-bundle-section-header">Recent</header>
  {recentItems.map((item) => (
    <button key={item.id} type="button" onClick={() => onRecentSelect?.(item)}>
      {item.label}
    </button>
  ))}
</section>
```

- [ ] **Step 3: Source recent quick-open items in `App.tsx` and pass them into the sidebar**

```ts
const refreshQuickOpenItems = useCallback(async () => {
  const api = window.markflow
  if (!api) return []
  const items = await api.getQuickOpenList()
  setQuickOpenItems(items)
  return items
}, [])
```

- [ ] **Step 4: Remove the separate right-outline dependency when the bundle sidebar can render it**

```tsx
{showSidebar && !isImmersiveMode ? (
  <VaultSidebar
    outlineItems={outlineHeadings}
    recentItems={quickOpenItems.filter((item) => item.isRecent)}
    activeOutlineAnchor={activeOutlineAnchor}
    onRecentSelect={handleQuickOpenSelect}
    onOutlineSelect={handleOutlineNavigate}
    ...
  />
) : null}
```

- [ ] **Step 5: Upgrade starter/docs copy in `documents.ts`**

```ts
export const INITIAL_CONTENT = `# MarkFlow

Write in flow. Publish with structure.

## What this workspace bundle gives you
...`
```

- [ ] **Step 6: Run the focused sidebar + App tests to verify they pass**

Run: `pnpm --filter @markflow/editor exec vitest run src/components/VaultSidebar.test.tsx src/__tests__/App.test.tsx`
Expected: PASS for the new bundle-sidebar behavior.

### Task 4: Implement the shared overlay shell and align surfaces

**Files:**
- Create: `packages/editor/src/components/OverlayScreen.tsx`
- Create: `packages/editor/src/components/OverlayScreen.css`
- Modify: `packages/editor/src/components/QuickOpen.tsx`
- Modify: `packages/editor/src/components/QuickOpen.css`
- Modify: `packages/editor/src/components/GlobalSearch.tsx`
- Modify: `packages/editor/src/components/GlobalSearch.css`
- Modify: `packages/editor/src/components/GoToLine.tsx`
- Modify: `packages/editor/src/components/GoToLine.css`
- Modify: `packages/editor/src/components/CommandPalette.tsx`
- Modify: `packages/editor/src/components/CommandPalette.css`

- [ ] **Step 1: Build a minimal shared overlay wrapper**

```tsx
export function OverlayScreen({ title, eyebrow, description, footer, children, ...props }: OverlayScreenProps) {
  return (
    <div className="mf-overlay-screen-backdrop" {...props}>
      <section className="mf-overlay-screen-card">
        <header className="mf-overlay-screen-header">
          <span className="mf-overlay-screen-eyebrow">{eyebrow}</span>
          <h2 className="mf-overlay-screen-title">{title}</h2>
          {description ? <p className="mf-overlay-screen-description">{description}</p> : null}
        </header>
        <div className="mf-overlay-screen-body">{children}</div>
        {footer ? <footer className="mf-overlay-screen-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Recompose command palette, quick open, global search, and go-to-line on top of that wrapper**

```tsx
<OverlayScreen
  title="Open quickly"
  eyebrow="Workspace"
  description="Jump between nearby and recent documents."
  footer={footer}
>
  ...
</OverlayScreen>
```

- [ ] **Step 3: Collapse duplicated overlay CSS into shared tokens and leave component CSS for list/body specifics**

```css
.mf-overlay-screen-card {
  width: min(640px, 100%);
  border-radius: var(--mf-radius-xl);
  background: color-mix(in srgb, var(--mf-bg-elevated) 92%, transparent);
}
```

- [ ] **Step 4: Run the overlay-focused tests to verify they pass**

Run: `pnpm --filter @markflow/editor exec vitest run src/components/commandPalette.test.tsx src/components/OverlayScreen.test.tsx`
Expected: PASS for the shared overlay shell and updated command palette assertions.

### Task 5: Verify the full editor package and workspace status

**Files:**
- Modify if needed: `harness/progress.md`

- [ ] **Step 1: Run the editor test suite**

Run: `pnpm --filter @markflow/editor exec vitest run`
Expected: PASS

- [ ] **Step 2: Run editor lint**

Run: `pnpm --filter @markflow/editor lint`
Expected: PASS

- [ ] **Step 3: Run editor build**

Run: `pnpm --filter @markflow/editor build`
Expected: PASS

- [ ] **Step 4: Run harness verification**

Run: `pnpm harness:verify`
Expected: `Harness verification passed.`

- [ ] **Step 5: Record a concise handoff**

```md
### 2026-04-19 - Aggressive bundle layout overhaul

- Focus: merged sidebar navigation, aligned overlays, and starter/docs surface refresh.
- Verification: ...
- Remaining risk: ...
```

Plan note: the user explicitly invoked `ralph` and the workspace AGENTS contract says to proceed autonomously on clear next steps, so execution should continue inline after this plan instead of waiting for a separate execution-choice response.
