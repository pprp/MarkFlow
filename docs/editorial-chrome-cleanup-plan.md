# Editorial Chrome Cleanup Plan

## Goal

Reduce the feeling of duplicated, overly heavy chrome around a single open document without changing multi-tab workflows.

## Phase 1

1. Treat the titlebar document title as the primary document identity surface.
2. Hide the tab strip when there is only one open tab.
3. Preserve the existing multi-tab strip when two or more documents are open.
4. Lock the new behavior with regression tests before changing production code.

## Guardrails

- Do not change split view layout in this slice.
- Do not redesign the left sidebar in this slice.
- Do not alter multi-tab close behavior in this slice.

## Follow-up Priorities

1. Simplify titlebar controls and reduce mode-toggle density.
2. Reduce left-rail density and unify active-state styling.
3. Rebalance split view proportions and divider treatment.
4. Quiet the status bar default state.

## Phase 2

1. Remove the duplicate decorative logo from the centered document title cluster.
2. Keep the centered document title as the only primary focal point in the titlebar.
3. Preserve `Typewriter` and `Focus` functionality, but demote them from text buttons to compact icon-first controls with accessible labels and tooltips.
4. Keep the `Files` button and the view-mode segmented control visible in the titlebar.
5. Lock the titlebar density changes with regression tests before changing production code.

## Phase 3

1. Replace the tall marketing-style workspace hero with a compact workspace summary when a folder is open.
2. Keep the richer empty-state presentation only for the no-folder sidebar state.
3. Remove redundant `Recent` badges from the `Recent` section, while still keeping other badges such as `Pinned` or `Folder` when they matter.
4. Preserve search, recent selection, outline selection, and file actions.
5. Lock the density reduction with component tests before changing production code.

## Phase 4

1. Rebalance split view so the writing surface is the primary pane by default, with preview treated as a supporting pane instead of a co-equal twin.
2. Replace the hard 1px split seam with a lighter drag rail that still preserves discoverable resizing.
3. Introduce explicit source and preview pane roles in the DOM so the two surfaces can be styled with different visual weight.
4. Preserve split-view synchronization and drag-resize behavior.
5. Lock the new split-view hierarchy with editor tests before changing production code.
