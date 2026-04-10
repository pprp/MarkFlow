# MarkFlow Agent Team

This repository uses one durable 4-role loop to keep feature discovery, implementation, review, and scheduling aligned with the harness workflow.

## Operating Rule

1. Start every session with `pnpm harness:start`.
2. Run `./harness/init.sh --smoke` before any new feature work.
3. Work on exactly one feature at a time from `harness/feature-ledger.json`.
4. Verify the change, then update the ledger and append a short progress note before handing off.

## Roles

### Researcher

- Compare Typora-relevant behavior from the public web against the current MarkFlow repo.
- Identify missing or partially implemented features.
- Propose ledger updates by adding or refining entries in `harness/feature-ledger.json` only.
- Prefer evidence-backed notes: what exists, what is missing, and why the gap matters.

### Implementer

- Pick the next unpassed feature with the highest priority and lowest dependency risk.
- Make the smallest code change that completes that feature.
- Touch only product code, tests, and the minimum supporting files needed for the feature.
- Do not broaden scope to a second feature unless the current one is blocked by a prerequisite bug.

### Reviewer

- Inspect the Implementer’s diff for correctness, regression risk, and alignment with the feature steps.
- Confirm the change matches the ledger’s verification plan.
- Reject partial implementations that cannot be verified or that silently change unrelated behavior.
- Require the Implementer to fix issues before the cycle can close.

### Dispatcher

- Coordinate the three roles and keep them in order: Researcher -> Implementer -> Reviewer.
- Decide when research should refresh the ledger, when implementation should start, and when review is sufficient.
- Resolve contention by keeping the current feature in focus and deferring new discoveries into the ledger.
- Own the session handoff: ensure `harness/feature-ledger.json` and `harness/progress.md` are updated before stopping.

## File Ownership Boundaries

- `harness/feature-ledger.json`: Researcher proposes changes, Dispatcher approves final state.
- Product source files: Implementer owns the change set for the active feature.
- Review notes and handoff status: Reviewer validates, Dispatcher records the session outcome in `harness/progress.md`.
- No role edits files outside its lane unless the change is a minimal prerequisite for the active feature.

## Conflict-Avoidance Rules

- Never let two roles edit the same file at the same time.
- Never start a new feature while the current feature is still unverified.
- Never mark `passes: true` unless the stated verification actually succeeded.
- Never delete or reorder ledger entries casually; add notes instead.
- If research finds a new feature, record it and schedule it for a later cycle instead of interrupting the current implementation.

## Completed Cycle

A cycle is complete only when all of the following are true:

- one feature has been selected, implemented, and reviewed
- the listed verification has passed or the feature is explicitly left in a recoverable partial state
- `harness/feature-ledger.json` matches reality, including `passes`, `status`, and `lastVerifiedAt`
- `harness/progress.md` contains a concise handoff describing what changed, what was verified, and the next recommended feature

## Practical Rhythm

- Researcher refreshes the backlog from Typora behavior and repo gaps.
- Dispatcher selects the next feature and starts the implementation loop.
- Implementer finishes one feature end to end.
- Reviewer validates the change.
- Dispatcher records the result and starts the next cycle.

