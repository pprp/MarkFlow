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
