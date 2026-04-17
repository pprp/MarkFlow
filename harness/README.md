# MarkFlow Long-Running Agent Harness

This harness adapts the patterns from Anthropic's "Effective harnesses for long-running agents" to MarkFlow's current monorepo and product roadmap:

- use a durable project spec so each fresh session can recover the product intent quickly
- keep a machine-editable feature ledger in JSON so agents do not prematurely declare victory
- require a progress log so each session leaves a clear handoff for the next one
- centralize environment bootstrap and smoke verification in `init.sh`

## Files

- `harness/project-spec.md`: expanded app spec and architectural constraints for MarkFlow
- `harness/feature-ledger.json`: metadata source of truth for what is verified, next up, or still planned
- `harness/features/MF-XXX.md`: long-form notes, steps, and verification details for each feature
- `harness/progress.md`: append-only handoff log
- `harness/init.sh`: workspace bootstrap plus smoke verification entrypoint
- `scripts/harness/*.mjs`: helper scripts that summarize status, choose the next feature, and validate the ledger

## Session Loop

1. Run `pnpm harness:start`.
2. Run `./harness/init.sh --smoke`.
3. Pick the highest-priority feature with `"passes": false`.
4. Implement only that feature, plus any minimal prerequisite cleanup.
5. Run targeted verification and any broader smoke checks that changed code paths need.
6. Update `harness/feature-ledger.json`, the relevant `harness/features/MF-XXX.md`, and append a short note to `harness/progress.md`.
7. Commit the session in a clean, reviewable state.

## Guardrails

- Do not delete or reorder features casually. Add long-form context in the per-feature markdown file instead of bloating the JSON metadata.
- Treat `passes` as the strongest signal in the ledger. Flip it to `true` only after the listed verification actually succeeds.
- Leave the repo in a state another engineer could continue from immediately.
- Prefer fixing a broken smoke path before starting new feature work.

## Recommended Commands

```bash
pnpm harness:start
pnpm harness:next
pnpm harness:verify
./harness/init.sh --smoke
./harness/init.sh --editor-dev
./harness/init.sh --desktop-dev
```
