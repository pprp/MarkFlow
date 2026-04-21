### 2026-04-21T16:08:41+08:00 - MF-076 automation rerun passed; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made because the existing `MF-076` implementation and regression coverage remain in place.
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
    - `osascript -e 'id of app "Microsoft Word"'`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression suite instead of changing already-covered behavior.
  - Preserved the ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance remains incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - The worktree has unrelated pre-existing local changes, including ledger additions for future features; this session did not modify or stage them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T16:57:26+08:00 - MF-076 remains unpromoted; lint and Word gates still block completion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second product feature was implemented.
- What changed:
  - Added a minimal `ResizeObserver` shim in `packages/editor/src/test-setup.ts` after the required smoke run exposed jsdom's missing `ResizeObserver` for the current working tree's `ContentWidthHandle`.
  - Updated `harness/features/MF-076.md` with refreshed verification evidence and blocker state.
  - Fixed only the local harness-note syntax for `harness/features/MF-136.md` by changing its `## Steps` list from numbered items to `-` bullets so `pnpm harness:verify` could parse the current working tree. `MF-136` was not implemented.
  - Did not update `harness/feature-ledger.json` for `MF-076`.
- Changed files:
  - `packages/editor/src/test-setup.ts`
  - `harness/features/MF-076.md`
  - `harness/features/MF-136.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `MF-076` smart-paste coverage instead of changing already-implemented paste behavior.
  - Kept the `ResizeObserver` fix in the shared test setup to avoid staging unrelated pre-existing `App.tsx` feature work.
  - Preserved ledger truth instead of promoting `MF-076` with incomplete lint and manual evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - Initial `./harness/init.sh --smoke` failed with `ResizeObserver is not defined` in `packages/editor/src/App.tsx`.
  - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx -t "hydrates an already-open desktop document on mount"` failed before the shim and passed after it (`1` passed, `60` skipped).
  - Re-run `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - First `pnpm harness:verify` failed on local `MF-136` note syntax; re-run after the bullet-list syntax correction passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 ...` found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - `pnpm --filter @markflow/editor lint` failed on pre-existing unrelated local zoom/content-width edits:
    - `packages/editor/src/App.tsx`: unused `WIDTH_MIN`, unused `WIDTH_MAX`, unused `updateZoomLevel`.
    - `packages/editor/src/contentWidthPreferences.ts`: empty block statement.
    - `packages/editor/src/zoomPreferences.ts`: empty block statement.
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - `MF-076` still cannot be marked complete because the required lint command is not green in the current working tree and the Word/webpage/VS Code manual paste matrix remains incomplete.
  - The working tree contains unrelated pre-existing edits and new future feature metadata (`MF-122` through `MF-136`); this session did not implement or validate those features.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because verification is incomplete.
- Next recommended feature:
  - Clear the unrelated local lint blockers, then continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed and complete the full paste matrix before promoting the ledger.

### 2026-04-21T16:31:46+08:00 - MF-076 automation remains green; Word manual matrix still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of changing already-green implementation.
  - Preserved ledger truth instead of promoting `MF-076` from automated evidence alone.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T14:12:26+08:00 - MF-076 automation rerun passed; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for harness-selected `MF-076`; no unrelated feature was implemented.
- What changed:
  - No editor or desktop source changes were made because `MF-076` implementation and regression coverage already exist.
  - Ran the required startup sequence:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \)`
    - `Computer Use` app enumeration.
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` regression suite and editor lint/build checks instead of touching already-green code.
  - Kept `harness/feature-ledger.json` truthful and unchanged for `MF-076` because the required manual matrix is still incomplete.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed after the handoff edits (`features: 135 total | verified=76 | ready=43 | planned=15 | blocked=1 | regression=0`; next: `MF-124`).
    - The changed feature count and next pointer come from unrelated unstaged ledger/feature-file additions in the working tree; this session did not implement or stage those features.
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Visual Studio Code.app`, `/Applications/Safari.app`, and `/Applications/Microsoft Edge.app`, but no Word app.
    - `Computer Use` listed Microsoft Edge, Visual Studio Code, Safari, Microsoft Outlook, Microsoft PowerPoint, and MarkFlow, but no Microsoft Word.
- Failed verification / blocker:
  - The required manual acceptance remains incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
- Remaining risks:
  - `MF-076` still cannot be promoted to `status=verified`, `passes=true`, or a non-null `lastVerifiedAt` until the full manual matrix completes in a trusted desktop session.
  - The workspace has unrelated unstaged changes, including `harness/feature-ledger.json` additions for `MF-122` and `MF-124` through `MF-135`; this session did not implement or stage them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:54:49+08:00 - MF-076 automation still green; Word remains unavailable for manual acceptance

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the latest verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of modifying already-green implementation.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:49:05+08:00 - MF-076 automation remains green; Word manual gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for harness-selected `MF-076`; no unrelated feature was implemented.
- What changed:
  - No editor or desktop source changes were made because the existing `MF-076` implementation and regression coverage remain correct under automated verification.
  - Ran the required startup sequence:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the focused `smartPaste` regression suite and editor lint/build checks instead of changing already-green source code.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance remains incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:42:36+08:00 - MF-076 automation remains green; manual Word gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of changing already-green implementation.
  - Preserved the ledger truth instead of promoting `MF-076` from automated evidence alone.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:35:44+08:00 - MF-076 automation reconfirmed; Word gate remains unavailable

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of changing already-green implementation.
  - Trimmed stale repeated Word-environment checks from `harness/features/MF-076.md` while preserving the current blocker and partial live evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:20:40+08:00 - MF-076 verified by automation; Word gate remains blocked

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked whether the local machine can complete the required manual matrix:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression suite instead of changing already-implemented behavior.
  - Kept `harness/feature-ledger.json` truthful because the manual acceptance matrix is still incomplete.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - `MF-076` still needs paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V` in a trusted desktop session.
  - The worktree still contains unrelated pre-existing local changes and untracked future feature files; this session did not stage them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` on a machine with `Microsoft Word.app` installed, then complete the full paste matrix before promoting the ledger.

### 2026-04-21T13:59:35+08:00 - MF-076 automation rerun passed; Word manual gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \)`
    - `Computer Use` app enumeration.
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of touching already-green implementation.
  - Stopped at the missing-Word gate rather than promoting the ledger from automation-only proof.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 123 total | verified=76 | ready=31 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
    - `Computer Use` listed Microsoft Edge, Visual Studio Code, Safari, Microsoft Outlook, Microsoft PowerPoint, and MarkFlow, but no Microsoft Word.
- Failed verification / blocker:
  - The required manual acceptance remains incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
- Remaining risks:
  - `MF-076` still cannot be promoted to `status=verified`, `passes=true`, or a non-null `lastVerifiedAt` until the full manual matrix completes in a trusted desktop session.
  - `harness/feature-ledger.json` still has unrelated pre-existing changes adding `MF-122`; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T14:06:25+08:00 - MF-076 automation rerun passed; Word manual gate remains unavailable

- Author: Codex
- Focus: strict one-feature session for harness-selected `MF-076`; no unrelated feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Ran the required startup sequence:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \)`
    - `Computer Use` app enumeration.
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build verification instead of changing already-green implementation.
  - Kept `harness/feature-ledger.json` unchanged because the required manual matrix is still incomplete.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 123 total | verified=76 | ready=31 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
    - `Computer Use` listed Edge, VS Code, Safari, Outlook, PowerPoint, and MarkFlow, but no Microsoft Word.
- Remaining risks:
  - The required manual acceptance remains incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The workspace still has unrelated pre-existing edits, including `harness/feature-ledger.json` changes for `MF-122`; this session did not modify or stage them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the full manual matrix has not completed.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete and record the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-20T15:26:58+08:00 - MF-076 closeout rerun (automation green again, Word gate still blocks honest completion)

- Author: Codex
- Focus: strict one-feature session for `MF-076` only, refresh the required verification on the current tree, and write the still-blocked closeout state back into the harness files without widening scope.
- What changed:
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Rewrote `harness/features/MF-076.md` into a concise current-state summary so the feature note preserves the same truth without another copy of the rerun log.
  - Updated `harness/progress.md`; left `harness/feature-ledger.json` unchanged.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Collapsed the repeated rerun prose in `harness/features/MF-076.md` into a single current-status summary plus the still-relevant partial manual evidence and blocker state.
  - Reused the existing focused `smartPaste` verification path instead of touching already-green implementation or tests.
- Verification:
  - `pnpm harness:start` completed at session start and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual gate is still blocked:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort` only found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`.
- Failed verification / blocker:
  - The required manual matrix for Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V` could not be completed honestly because `Microsoft Word.app` is absent in this environment, and this session did not produce any new trustworthy native plain-text-shortcut proof that would close the remaining gap.
- Remaining risks:
  - `MF-076` still cannot be promoted to `status=verified` or `passes=true` until the full three-source manual matrix completes in a trusted desktop session.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut matrix before promoting the ledger.

### 2026-04-20T15:06:52+08:00 - MF-076 closeout rerun (fresh automation green, Word gate still blocks truthful promotion)

- Author: Codex
- Focus: strict one-feature protocol completion for `MF-076` on the current tree, without widening scope beyond the remaining manual acceptance gate.
- What changed:
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated only `harness/features/MF-076.md` and `harness/progress.md`; left `harness/feature-ledger.json` unchanged because the manual matrix is still incomplete.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` verification path instead of touching already-green implementation or tests.
  - Stopped at the environment gate once Spotlight and filesystem checks again confirmed `Microsoft Word.app` is absent, because that alone blocks honest completion of the required Word/webpage/VS Code matrix.
- Verification:
  - `pnpm harness:start` passed and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate remains blocked:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' \)` returned no results.
    - `/Applications` exposed `Microsoft Edge.app`, `Safari.app`, and `Visual Studio Code.app`, but still no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance for `MF-076` is still incomplete because the feature note requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed and working native app control, then complete the Word/webpage/VS Code with-and-without-shortcut matrix before promoting the ledger.

### 2026-04-20T06:48:44Z - MF-076 closeout rerun (required automation green, Word gate still blocks honest completion)

- Author: Codex
- Focus: strict one-feature protocol completion for `MF-076` on the current tree, without widening scope beyond the remaining manual acceptance gate.
- What changed:
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Visual Studio Code.app' -o -name 'Safari.app' \) 2>/dev/null | sort`
  - Updated only `harness/features/MF-076.md` and `harness/progress.md`; left `harness/feature-ledger.json` unchanged because the manual matrix is still incomplete.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` verification path instead of touching already-green implementation or tests.
  - Stopped at the environment gate once Spotlight and filesystem checks again confirmed `Microsoft Word.app` is absent, because that alone blocks honest completion of the required Word/webpage/VS Code matrix.
- Verification:
  - `pnpm harness:start` passed and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate remains blocked:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' \)` returned no results.
    - `/Applications` exposed `Microsoft Edge.app`, `Safari.app`, and `Visual Studio Code.app`, but still no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance for `MF-076` is still incomplete because the feature note requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed and working native app control, then complete the Word/webpage/VS Code with-and-without-shortcut matrix before promoting the ledger.

### 2026-04-20T06:42:27Z - MF-076 closeout rerun (automation green, Word missing and native desktop control still blocked)

- Author: Codex
- Focus: strict one-feature protocol completion for `MF-076` on the current tree, without widening scope beyond the remaining manual acceptance gate.
- What changed:
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' \)`
    - `ls /Applications | rg 'Codex|Microsoft|Safari|Visual Studio Code|Word'`
    - `Computer Use` app enumeration
  - Updated only `harness/features/MF-076.md` and `harness/progress.md`; left `harness/feature-ledger.json` unchanged because the manual matrix is still incomplete.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` verification path instead of touching already-green implementation or tests.
  - Stopped at the environment gate once both Spotlight and filesystem search confirmed `Microsoft Word.app` is absent, because that alone blocks honest completion of the required Word/webpage/VS Code matrix.
- Verification:
  - `pnpm harness:start` passed and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate remains blocked:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' \)` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but still no `Microsoft Word.app`.
    - `Computer Use` app enumeration still failed with Apple event error `-1743`, so native desktop fallback automation remains unavailable in this session.
- Remaining risks:
  - The required manual acceptance for `MF-076` is still incomplete because the feature note requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Without trusted native desktop control, there is still no honest fallback to complete the missing Word/manual-shortcut path inside this session.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed and working native app control, then complete the Word/webpage/VS Code with-and-without-shortcut matrix before promoting the ledger.

### 2026-04-20T06:36:38Z - MF-076 closeout rerun (automation green, Word/manual-control gates still block honest completion)

- Author: Codex
- Focus: strict one-feature protocol completion for `MF-076` on the current tree, without widening scope beyond the remaining verification gate.
- What changed:
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `ls /Applications | rg 'Codex|Microsoft|Safari|Visual Studio Code'`
  - Recorded the current blocker state in `harness/features/MF-076.md` and appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` verification path instead of touching already-green implementation or tests.
  - Did not rerun partial packaged-app clipboard probes, because the missing `Microsoft Word.app` bundle still prevents an honest completion of the required three-source manual matrix by itself.
- Verification:
  - `pnpm harness:start` passed and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate remains blocked:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but still no `Microsoft Word.app`.
    - `Computer Use` app enumeration still fails with Apple event error `-1743`, so native desktop fallback automation remains unavailable in this session.
- Remaining risks:
  - The required manual acceptance for `MF-076` is still incomplete because the feature note requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Without trusted native desktop control, there is still no honest fallback to complete the missing Word/manual-shortcut path inside this session.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed and working native app control, then complete the Word/webpage/VS Code with-and-without-shortcut matrix before promoting the ledger.

### 2026-04-20T06:12:39Z - MF-076 closeout rerun (automation green, Word gate still blocks manual matrix)

- Author: Codex
- Focus: strict one-feature closeout for `MF-076` on the current tree, with startup protocol already completed and ledger truth preserved.
- What changed:
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `ls /Applications | rg 'Codex|Microsoft|Safari|Visual Studio Code'`
  - Updated only `harness/features/MF-076.md` and `harness/progress.md`; left `harness/feature-ledger.json` unchanged because the manual matrix is still incomplete.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused automation set instead of widening scope into unrelated renderer or desktop probes.
  - Stopped at the environment gate once `Microsoft Word.app` was confirmed missing, because that alone prevents honest completion of the required Word/webpage/VS Code matrix.
- Verification:
  - `pnpm harness:start` passed at session start and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-20T05:59:29Z - MF-076 closeout rerun (automation green, Word-gated manual matrix still blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-076` (paste as plain text shortcut strips rich formatting before insertion).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required feature automation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `ls /Applications | rg 'Microsoft|Safari|Visual Studio Code|Codex'`
  - Updated only `harness/features/MF-076.md` and `harness/progress.md`; left `harness/feature-ledger.json` unchanged because the required manual matrix is still incomplete.
- Simplifications made:
  - Reused the existing `MF-076` automation set instead of widening scope into unrelated editor or desktop verification.
  - Did not rerun partial packaged-app clipboard probes from Edge or VS Code because missing `Microsoft Word.app` already makes the required three-source matrix impossible to complete honestly in this environment.
- Verification:
  - `pnpm harness:start` passed and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree (`packages/desktop`: `10` test files / `65` tests; `packages/editor`: `43` test files / `467` tests / `3` skipped).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed: `1` file, `7` tests passed.
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual acceptance remains blocked: `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results, and `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but still no `Microsoft Word.app`.
- Remaining risks:
  - `MF-076` cannot be promoted honestly until the required Word/webpage/VS Code with-and-without-shortcut matrix is completed in a trusted desktop session.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged at `MF-076.status=ready`, `MF-076.passes=false`, and `MF-076.lastVerifiedAt=null`.
- Next recommended feature:
  - Continue with `MF-076` only after `Microsoft Word.app` is available and the full three-source shortcut comparison can be executed in a trusted desktop session.

### 2026-04-19T11:51:56Z - MF-072 verified in a live renderer image-resize session

- Author: Codex
- Focus: strict one-feature completion for `MF-072` (image drag-to-resize handles persist width/height into markdown source).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required feature automation:
    - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/linkDecoration.test.tsx`
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/linkDecoration.test.tsx`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Completed live acceptance against the production renderer preview at `http://localhost:4173` with three temporary SVG fixtures served from `http://localhost:4174`.
  - Updated only `harness/features/MF-072.md`, `harness/feature-ledger.json`, and `harness/progress.md` after the feature passed focused automation and live acceptance.
- Simplifications made:
  - Reused three local HTTP-served SVG fixtures with distinct aspect ratios instead of introducing packaged sample assets or routing through the desktop shell.
  - Kept the proof path renderer-only because the resize logic under test lives in `@markflow/editor`; the current desktop watcher churn is unrelated to this feature.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed on the current tree.
  - `pnpm --filter @markflow/editor test:run -- src/editor/__tests__/linkDecoration.test.tsx` failed because that package script currently fans out to the full editor suite and hit an unrelated dirty-tree failure in `src/__tests__/App.test.tsx` (`renders a quieter titlebar by demoting secondary writing modes to icon controls`).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/linkDecoration.test.tsx` passed: `1` test file, `9` tests passed.
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed before and after the ledger update.
  - Live renderer acceptance passed on `http://localhost:4173`:
    - the three-image fixture rendered all three resizeable image widgets once the caret moved off the final image line;
    - dragging the southeast handle persisted `416x234`, `312x312`, and `223x372` sizes into Source mode as canonical `{width=... height=...}` attributes;
    - returning to Preview reapplied those exact persisted sizes to all three image widgets, so the renderer round-tripped the markdown without corruption.
- Remaining risks:
  - The `test:run -- <path>` alias is currently misleading for single-feature closeout because it still executes the entire editor suite and can be dragged red by unrelated dirty-tree failures.
  - The manual gate was satisfied in the live renderer preview rather than a directly driven Electron window; that is sufficient for `MF-072` because the behavior under test is renderer-only.
  - The workspace still contains unrelated pre-existing edits in `packages/desktop/src/main/index.ts`, `packages/desktop/src/main/menu.test.ts`, `packages/desktop/src/main/menu.ts`, `packages/desktop/src/main/themeManager.ts`, `packages/desktop/src/preload/index.ts`, `packages/editor/src/App.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/editor/src/components/VaultSidebar.css`, `packages/editor/src/components/VaultSidebar.tsx`, `packages/editor/src/styles/global.css`, and `packages/shared/src/index.ts`; this session did not normalize them.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-072.status=verified`, `MF-072.passes=true`, and `MF-072.lastVerifiedAt=2026-04-19T11:51:56Z`.
- Next recommended feature:
  - `MF-074` - Command palette (Cmd/Ctrl+Shift+P) invokes any editor or desktop action by name.

### 2026-04-19T11:32:08Z - MF-068 verified in a live renderer table-command session

- Author: Codex
- Focus: strict one-feature completion for `MF-068` (table editing hotkeys for row/column insertion and row movement).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required feature automation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/tableCommands.test.ts`
    - `pnpm --filter @markflow/editor lint`
  - Completed live acceptance against the current renderer preview at `http://localhost:5173` with a 20-row, 5-column mixed-alignment table fixture.
  - Updated only `harness/features/MF-068.md`, `harness/feature-ledger.json`, and `harness/progress.md` after the feature passed both automation and live acceptance.
- Simplifications made:
  - Reused one generated 20x5 mixed-alignment table fixture for all row/column command checks instead of preparing separate files per shortcut.
  - Used the live renderer preview rather than a fully booted Electron shell because the behavior under test lives in `@markflow/editor` and the current desktop watcher errors are unrelated to the table-command path.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed on the current tree.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/tableCommands.test.ts` passed twice in this session: `1` test file, `10` tests passed.
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm harness:verify` passed before and after the ledger update.
  - Live renderer acceptance passed on `http://localhost:5173`:
    - `Cmd+Enter` from `R10C3` inserted a blank row below row 10, expanded the body from `20` to `21` rows, and kept the selection on the inserted row through undo, redo, and Source/Preview toggles.
    - `Tab` from `R20C5` appended a blank row 21, undo restored the caret to `R20C5`, redo restored the appended row, and Source/Preview toggles preserved both the row count and selection.
    - `Cmd+Shift+Backspace` on `R12C2` removed row 12, moved selection to `R13C2`, and kept the table rectangular through undo, redo, and Source/Preview toggles.
    - `Alt+ArrowUp` and `Alt+ArrowDown` moved row 10 up and back down while keeping the selected cell on `R10C2`; the header and delimiter rows stayed intact across both undo/redo cycles.
    - `Cmd+Alt+ArrowRight` inserted a blank column to the right of `R08C4`, increasing the table from `5` to `6` columns; `Cmd+Alt+Backspace` removed it again, returning the table to `5` columns. Both operations stayed rectangular through undo, redo, and Source/Preview toggles.
    - The delimiter row normalized dash widths after edits but preserved alignment markers (`:---`, `---:`, `:---:`), so there was no malformed markdown or separator drift.
- Remaining risks:
  - `pnpm desktop` still cannot launch the Electron shell cleanly in this workspace because unrelated desktop theme API watcher errors remain in `packages/desktop/src/main/index.ts` and `packages/desktop/src/main/menu.ts`.
  - The manual gate was therefore satisfied in the live renderer preview rather than a directly driven Electron window; that is sufficient for `MF-068` because the feature logic under test is renderer-only.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-068.status=verified`, `MF-068.passes=true`, and `MF-068.lastVerifiedAt=2026-04-19T11:32:08Z`.
- Next recommended feature:
  - `MF-072` - Image drag-to-resize handles update width/height in markdown source.

### 2026-04-19T10:35:59Z - MF-067 verified in a live renderer math session

- Author: Codex
- Focus: strict one-feature completion for `MF-067` (alternate LaTeX delimiters in WYSIWYG math rendering).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required feature automation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/mathDecoration.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Completed live acceptance against the current production renderer preview at `http://localhost:4173`.
  - Did not modify `MF-067` implementation files; updated only `harness/features/MF-067.md`, `harness/feature-ledger.json`, and `harness/progress.md` after the feature passed both automation and live acceptance.
- Simplifications made:
  - Reused one mixed-delimiter fixture to cover `$...$`, `$$...$$`, `\(...\)`, and `\[...\]` in a single pass.
  - Kept the proof path renderer-only because the behavior under test lives in `@markflow/editor`; no desktop-shell-specific code path is involved in `MF-067`.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed on the current tree.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/mathDecoration.test.ts` passed: `1` test file, `20` tests passed.
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed before and after the ledger update.
  - Live renderer acceptance passed with Preview mode active:
    - the mixed-delimiter fixture rendered exactly `2` `.mf-math-inline` widgets plus `2` `.mf-math-block` widgets;
    - moving the caret into `\(a^2+b^2=c^2\)` dropped the inline widget count to `1` and surfaced raw `\(a^2+b^2=c^2\)` source;
    - moving the caret into `\[\int_0^1 x^2 dx\]` dropped the block widget count to `1` and surfaced raw `\[\int_0^1 x^2 dx\]` source;
    - `view.state.doc.toString()` stayed byte-for-byte identical to the fixture after both caret moves, so source delimiters remained editable without corruption.
- Remaining risks:
  - Manual acceptance was captured against the current production renderer preview rather than a directly driven Electron window; that is sufficient for `MF-067` because the feature logic is renderer-only, but it does not add any new evidence about unrelated desktop-shell behavior.
  - The workspace still contains unrelated pre-existing edits in `docs/editorial-chrome-cleanup-plan.md`, `packages/desktop/src/main/themeManager.test.ts`, `packages/desktop/src/main/themeManager.ts`, `packages/editor/src/App.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/editor/src/components/VaultSidebar.css`, `packages/editor/src/components/VaultSidebar.test.tsx`, `packages/editor/src/components/VaultSidebar.tsx`, `packages/editor/src/editor/MarkFlowEditor.tsx`, `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`, and `packages/editor/src/styles/global.css`; this session did not normalize them.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-067.status=verified`, `MF-067.passes=true`, and `MF-067.lastVerifiedAt=2026-04-19T10:35:59Z`.
- Next recommended feature:
  - `MF-068` - Table editing hotkeys support row/column insertion and row movement without raw markdown surgery.

### 2026-04-19T10:20:42Z - MF-061 verified in a live renderer lazy-image session

- Author: Codex
- Focus: strict one-feature completion for `MF-061` (lazy image loading for off-screen images).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Built the current renderer bundle and launched a headed Playwright Chromium session against `http://127.0.0.1:4173`.
  - Created a local 500-image verification fixture and served it from `http://127.0.0.1:4174`.
  - Did not modify `MF-061` implementation files; updated only `harness/features/MF-061.md`, `harness/feature-ledger.json`, and `harness/progress.md` after the feature passed both automated and live acceptance gates.
- Simplifications made:
  - Reused the existing shipped renderer bundle instead of creating a special verification build.
  - Leaned on the editor’s existing virtual rendering window, so the live proof measured cumulative resource loading rather than trying to force all `500` images into the DOM at once.
  - Kept the acceptance path renderer-only because the lazy-image behavior lives in `@markflow/editor`; the packaged Electron app still built successfully in this session, but its `page` target did not respond to `Runtime.enable`, so browser-side proof was the more reliable evidence source.
- Verification:
  - `pnpm --filter @markflow/editor test:run -- --grep lazy-image` passed on the current tree. In this repo’s current Vitest wiring the command exercised the full editor suite; result: `43` test files, `464` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/lazyImage.test.tsx` passed: `1` test file, `3` tests passed.
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed after the ledger update.
  - Live acceptance passed in the headed renderer session with `4x` CPU throttling:
    - at the top of the 500-image document, only `5` of `10` visible image widgets had `src` assigned/decoded and only `5` image resources had been fetched;
    - at mid-document, `8` of `11` visible image widgets were decoded and cumulative resource fetches rose to `9`;
    - at the bottom viewport, only `6` of `7` visible image widgets were decoded and cumulative resource fetches stayed at `9`, confirming off-screen images were not eagerly decoded;
    - a `120`-step scroll traversal increased cumulative fetched image resources to `250`, with `maxFrameGapMs=81.4`, `avgFrameGapMs=21.56`, `over100Ms=0`, `longTaskCount=1`, and `maxLongTaskMs=67`, so no obvious scroll jank appeared under the required CPU slowdown.
- Remaining risks:
  - No `MF-061`-specific blockers remain.
  - The manual gate was satisfied in the built renderer preview rather than via packaged Electron DevTools because the packaged app’s `page` target did not answer runtime CDP commands in this environment; that is a tooling limitation, not a feature failure, and the lazy-image logic under test is renderer-only.
  - The workspace still contains unrelated pre-existing edits in `docs/editorial-chrome-cleanup-plan.md`, `packages/desktop/src/main/themeManager.test.ts`, `packages/desktop/src/main/themeManager.ts`, `packages/editor/src/App.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/editor/src/components/VaultSidebar.css`, `packages/editor/src/components/VaultSidebar.test.tsx`, `packages/editor/src/components/VaultSidebar.tsx`, `packages/editor/src/editor/MarkFlowEditor.tsx`, `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`, and `packages/editor/src/styles/global.css`; this session did not modify or normalize them.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-061.status=verified`, `MF-061.passes=true`, and `MF-061.lastVerifiedAt=2026-04-19T10:20:42Z`.
- Next recommended feature:
  - `MF-067` - Alternate LaTeX delimiters `\(...\)` and `\[...\]` render as math in WYSIWYG mode.

### 2026-04-19T09:48:11Z - MF-054 verified in a live renderer acceptance session

- Author: Codex
- Focus: strict one-feature completion for `MF-054` (regex / case-sensitive / whole-word find-and-replace).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required feature verification command:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/findReplace.test.ts src/editor/__tests__/MarkFlowEditor.test.tsx`
  - Completed manual acceptance in a live headed Microsoft Edge renderer session at `http://localhost:5173`.
  - Updated only `harness/features/MF-054.md`, `harness/feature-ledger.json`, and `harness/progress.md` after the feature passed both automated and manual gates.
- Simplifications made:
  - Reused one five-line fixture to cover regex-only matching, case-sensitive narrowing, and whole-word replace-all instead of inventing separate manual fixtures.
  - Kept the proof path renderer-only because the feature logic under test lives in `@markflow/editor`; Electron launch was still exercised in this session, but the dev shell’s auto-opened DevTools made page-level CDP attachment unreliable.
- Verification:
  - `pnpm harness:start` passed and selected `MF-054` as the next ready feature.
  - `./harness/init.sh --smoke` passed on the current tree.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/findReplace.test.ts src/editor/__tests__/MarkFlowEditor.test.tsx` passed: `2` test files, `61` tests passed, `3` skipped.
  - Manual live acceptance passed in the headed renderer session:
    - `Cmd/Ctrl+H` opened the find-and-replace panel and focused the replace field.
    - Regexp query `Foo [0-9]+` highlighted exactly `3` matches: `foo 123`, `foo 456`, `Foo 789`.
    - Enabling match-case narrowed the highlighted set to exactly `1` match: `Foo 789`.
    - Switching to literal query `foo`, enabling whole-word, and running `Replace all` transformed the fixture to:
      - `dog 123`
      - `dog 456`
      - `dog 789`
      - `food 111`
      - `dog dog`
    - `diff -u` between expected and actual output was clean.
  - `pnpm harness:verify` passed after the ledger/progress updates.
- Remaining risks:
  - No `MF-054`-specific blockers remain.
  - Manual acceptance was captured against the live renderer session rather than a directly-driven Electron window because the dev Electron shell auto-opened DevTools and made page-target CDP unstable; the feature logic under test is renderer-only, so the acceptance evidence still matches the shipped behavior path.
  - The workspace still contains unrelated pre-existing edits in `docs/editorial-chrome-cleanup-plan.md`, `packages/editor/src/App.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/editor/src/components/VaultSidebar.css`, `packages/editor/src/components/VaultSidebar.test.tsx`, `packages/editor/src/components/VaultSidebar.tsx`, `packages/editor/src/editor/MarkFlowEditor.tsx`, `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`, and `packages/editor/src/styles/global.css`; this session did not modify or normalize them.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-054.status=verified`, `MF-054.passes=true`, and `MF-054.lastVerifiedAt=2026-04-19T09:48:11Z`.
- Next recommended feature:
  - `MF-061` - Lazy image loading defers off-screen image decoding until the image enters the viewport.

### 2026-04-19T08:42:10Z - MF-051 verified in a live renderer UI session

- Author: Codex
- Focus: strict one-feature completion for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Launched `pnpm desktop` to confirm the dev shell still boots.
  - Opened the live renderer at `http://localhost:5173` in a headed Microsoft Edge Playwright session because `Computer Use` access was unavailable and the feature scope is renderer-only (`@markflow/editor`).
  - Did not modify source or implementation files for `MF-051`; only `harness/features/MF-051.md`, `harness/feature-ledger.json`, and `harness/progress.md` were updated after verification succeeded.
- Verification:
  - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts` passed on the current tree: `42` test files, `459` tests passed, `3` skipped, `0` failed.
  - Manual UI verification passed in the live renderer session:
    - clicking `Proof Surface` in the outline scrolled the editor from `scrollTop=0` to `scrollTop=1224` and revealed the target section at the top of the canvas.
    - continuing to wheel-scroll moved the active outline item from `A Pull Quote` to `Proof Surface`, confirming viewport-driven sync.
    - adding `## Browser Verification Heading` in source mode immediately added a ninth outline item, and a single undo immediately removed it again.
  - `pnpm harness:verify` passed after the ledger/progress updates.
- Remaining risks:
  - No `MF-051`-specific blockers remain.
  - Manual acceptance was captured against the live renderer session rather than direct Electron window control; `pnpm desktop` launched successfully in the same session, and the feature logic under test lives in `@markflow/editor`.
- Ledger decision:
  - Updated `harness/feature-ledger.json` to `MF-051.status=verified`, `MF-051.passes=true`, and `MF-051.lastVerifiedAt=2026-04-19`.
- Next recommended feature:
  - `MF-053` - Fuzzy document-wide search highlights all matches and jumps between them with keyboard shortcuts.

### 2026-04-19T08:23:09Z - MF-051 verification loop (automation pass, desktop UI proof still blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation), with startup protocol and truthful verification state preserved.
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Ran the required feature verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Ran `pnpm harness:verify`.
  - Launched a real desktop dev session with `pnpm desktop` to pursue the missing `MF-051` manual proof path.
  - Did not modify source or implementation files; existing `MF-051` code remains unchanged.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed in this environment.
  - The required feature command passed on the current tree: `42` test files, `457` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - The missing acceptance evidence is still the trusted desktop manual check for outline click-to-jump, viewport-driven active-heading sync while scrolling, and live heading add/remove updates.
  - Although `pnpm desktop` launched Electron successfully, this session does not have a trustworthy window-control/inspection path for acceptance. `Computer Use` access was unavailable, and alternate headed-browser probing did not produce reliable UI evidence for ledger promotion.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) because the required manual desktop proof was not completed.
- Next recommended feature:
  - Continue with `MF-051` only. Re-run `./harness/init.sh --desktop-dev` in a session with trusted desktop UI access, open a multi-section markdown fixture, verify outline click-to-jump plus scroll-sync plus live heading add/remove, and only then set `status=verified`, `passes=true`, and `lastVerifiedAt`.

### 2026-04-17T22:06:14+08:00 - MF-051 protocol loop (automation pass, manual UI blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation), executed with the environment constraint that manual desktop UI verification is unavailable.
- What changed:
  - Ran required feature command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No source edits were required this round; existing `MF-051` implementation remains unchanged.
- Verification:
  - Targeted feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual scroll-sync check is still blocked in this environment (no trusted desktop session).
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` in an environment with trusted desktop UI access; only update ledger pass state after both automated and manual checks pass.

### 2026-04-17T22:10:31+08:00 - MF-051 protocol-compliant loop (automation verified, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Ran required automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Ran `pnpm harness:verify`.
  - Did not modify source code for `MF-051` in this round; existing implementation remains in place.
- Verification:
  - Feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
  - `./harness/init.sh --smoke` passed in this environment.
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync validation for `MF-051` cannot be executed here (no trusted UI session), so behavior against real viewport movement is not yet human-proven.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` once a desktop UI session is available; only then set `status=verified`, `passes=true`, and `lastVerifiedAt`.

### 2026-04-17T14:02:30Z - MF-051 protocol loop (automation verified, manual UI blocked)

- Author: Codex
- Focus: continue one-feature loop for `MF-051` (outline live scroll-sync and heading jump navigation), preserving ledger truthfulness when manual desktop check cannot run.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran feature verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
- Verification:
  - Feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `./harness/init.sh --smoke` passed (executes full test pipeline in this workspace).
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync validation for `MF-051` is blocked in this environment (no trusted UI session), so active-outline behavior against real multi-section scroll remains unverified here.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-071` only after completing trusted manual `MF-051` scroll-sync validation in an environment with desktop UI access, then update ledger only when both automated and manual checks are true.

### 2026-04-17T21:58:45Z - MF-051 protocol-compliant session (automation + no-op source edits)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and click-to-jump navigation).
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Ran feature automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No additional source changes were required in this pass; existing MF-051 implementation remains unchanged.
- Verification:
  - MF-051 feature automation passed: `40` test files, `451` tests passed, `3` skipped, `0` failed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
  - `./harness/init.sh --smoke` passed (including full test suite execution path).
- Remaining risk / blocker:
  - Trusted manual desktop scroll-sync verification for MF-051 is still blocked in this environment (no UI session), so active-outline tracking against real scrolling cannot be validated here.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Complete trusted manual multi-section scroll-sync validation for `MF-051` in desktop UI, then set `status/passes/lastVerifiedAt` only when both automated and manual checks are satisfied.

### 2026-04-17T13:55:31Z - MF-051 session loop (automation verified, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-051` (outline live scroll-sync and jump navigation).
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran feature verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - No source or implementation files changed; this pass validated existing MF-051 fix behavior.
- Verification:
  - Feature automation passed: `451` tests, `3` skipped, `0` failed (`40` test files executed).
  - `pnpm harness:verify` passed.
  - `./harness/init.sh --smoke` passed (internally running full-suite verification).
- Remaining risk / blocker:
  - Trusted manual desktop verification for scroll-sync tracking remains blocked in this environment; unable to validate viewport-driven outline highlighting against real UI interaction and scroll events.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt` unchanged) to avoid false completion.
- Next recommended feature:
  - Complete trusted manual scroll-sync check for `MF-051` in a desktop UI session, then promote `status/passes/lastVerifiedAt` when proof is present.

### 2026-04-17T21:52:08:z - MF-051 protocol-compliant one-feature session (automation pass, manual blocked)

- Author: Codex
- Focus: strict one-feature loop for .
- What changed:
  - Ran 
> markflow@0.1.0 harness:start /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/start-session.mjs

MarkFlow harness session start
repo: /Users/pprp/Workspace/MarkFlow
branch: main

features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0

recent git log:
76203bd Preserve MF-051 protocol truthfulness while manual scroll-sync remains blocked
5264898 Preserve MF-051 protocol truthfulness while manual scroll-sync is blocked
c9939ce Defer MF-051 completion until trusted manual scroll-sync proof is available
342efb3 Close MF-051 session loop with truthful verification state and progress evidence
044ab4b Preserve MF-051 verification truthfulness with protocol-compliant session logging

latest progress entry:
### 2026-04-17 - MF-051 loop rerun (automation-only, manual scroll-sync blocked)

- Author: Codex
- Focus: one-feature protocol completion for `MF-051` in this session.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran `MF-051` automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Did not modify source or implementation files for the feature; no new code changes required in this round.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed.
  - MF-051 automation passed: `40` test files, `451` tests passed, `3` skipped.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop verification for MF-051 active outline scrolling sync (scroll a multi-section document and confirm the active heading follows viewport) cannot be executed in this environment.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` and complete trusted manual scroll-sync verification, then promote `status`, `passes`, `lastVerifiedAt` only after real proof.

next recommended feature:
MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation
status: ready | priority: 2 | area: @markflow/editor
depends on: MF-050
notes:
  Implemented on 2026-04-15 in `packages/editor/src/App.tsx` and `packages/editor/src/editor/MarkFlowEditor.tsx` by sourcing outline entries from the background symbol table, keeping heading additions/renames asynchronous, and combining explicit navigation intent with editor scroll events so the active outline item tracks the current section without blocking on full-document reparses. Automated coverage in `src/__tests__/App.test.tsx`, `src/editor/__tests__/MarkFlowEditor.test.tsx`, and `src/editor/__tests__/outline.test.ts` passed on 2026-04-15 with the listed editor test command. `passes` remains false because the manual desktop scroll-sync check is still pending. BUG (found 2026-04-16, detailed live-preview test, starter document): The active-heading indicator does NOT track scroll when the document fits the rendered viewport. `activeOutlineAnchor` is computed from `activeTab.cursorPosition ?? activeTab.viewportPosition ?? 0` (App.tsx ~line 1592), and `viewportPosition` is fed by `update.view.viewport.from` / `view.scrollDOM scroll handler` in `MarkFlowEditor.tsx` (~lines 303–310 and 603–606). But `view.viewport.from` is CodeMirror's virtualized range start, not the currently scrolled-to position — for a small doc `viewport.from` stays at 0 regardless of `scrollDOM.scrollTop`. Reproduced live: after `document.querySelector('.cm-scroller').scrollTop = 2000` on the starter document, `.mf-outline-item-active` remained on "Welcome to MarkFlow". On initial load the active outline item was the LAST heading ("Footnote") while `scrollTop` was 0 — symptom of an initial cursor/viewport value past the last heading. Fix should derive the active anchor from the topmost visible line, e.g. `view.posAtCoords({x: 0, y: view.documentTop})` or the line at `view.scrollDOM.scrollTop`, not `view.viewport.from`.
  
  ## Update 2026-04-17
  - Implemented in `packages/editor/src/App.tsx`:
    - tracks whether the active outline anchor source is the cursor (explicit selection/navigation) or viewport (scroll),
    - preserves the cursor-driven behavior by default and when switching tabs,
    - recomputes the active outline anchor from the selected source.
  - Implemented in `packages/editor/src/editor/MarkFlowEditor.tsx`:
    - reports viewport updates from the top visible editor position (`view.posAtCoords(...)`) instead of `view.viewport.from`.
  - Added/updated regression coverage in:
    - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx` (`viewport callback reports top visible position`),
    - `packages/editor/src/__tests__/App.test.tsx` (`scrolling view updates outline active heading`).
  - Required automated verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Manual verification remains pending in this environment because no trusted desktop UI session was available for this cycle; `passes` remains false and `lastVerifiedAt` unchanged until manual scroll-sync check is completed.
steps:
  1. Open any document with multiple heading levels.
  2. Confirm the outline panel updates as headings are added or removed.
  3. Click a heading in the panel and confirm the editor scrolls to that heading.
  4. Scroll the editor and confirm the active heading in the panel tracks the viewport.
automated verification:
  - pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts
manual verification:
  - Manual scroll-sync check with a multi-section document.

recommended loop:
1. ./harness/init.sh --smoke
2. implement one feature only
3. run targeted verification
4. update harness/feature-ledger.json and harness/progress.md
5. commit the session in a clean state.
  - Ran [harness] Repo: /Users/pprp/Workspace/MarkFlow

> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation

> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/editor test:run$ vitest run
packages/desktop test:run$ vitest run --passWithNoTests
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 7ms
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 16ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 4ms
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 2ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 6ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 14ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 18ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 91ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 181ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:09
packages/desktop test:run:    Duration  741ms (transform 630ms, setup 0ms, collect 1.49s, tests 339ms, environment 2ms, prepare 767ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 42ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 72ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 44ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 105ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 109ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 140ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 73ms
packages/editor test:run: (node:32807) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 71ms
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 7ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 78ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 97ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 86ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 63ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 100ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 52ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 47ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 503ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 341ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 177ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 55ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 64ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 148ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1886ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 628ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 639ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 53ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 30ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 234ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 38ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 154ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 18ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 72ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 123ms
packages/editor test:run: (node:32908) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 2ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 5ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5100ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 437ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 645ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 405ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:09
packages/editor test:run:    Duration  6.56s (transform 1.02s, setup 1.67s, collect 4.69s, tests 10.07s, environment 10.26s, prepare 1.91s)
packages/editor test:run: Done.
  - Ran the feature verification command:
    - 
> @markflow/editor@0.1.0 test:run /Users/pprp/Workspace/MarkFlow/packages/editor
> vitest run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts


 RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor

 ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 73ms
 ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 56ms
 ✓ src/editor/__tests__/indexer.test.ts (19 tests) 103ms
 ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 94ms
 ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 50ms
 ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 174ms
 ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 83ms
 ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 4ms
 ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 70ms
 ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 54ms
 ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 78ms
 ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 56ms
 ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 68ms
 ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 61ms
 ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 40ms
 ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 35ms
 ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 130ms
 ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 48ms
 ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 160ms
 ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 548ms
   ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 401ms
 ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 63ms
 ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 4ms
 ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 69ms
 ✓ src/export/htmlExport.test.ts (3 tests) 45ms
 ✓ src/editor/__tests__/folding.test.tsx (3 tests) 137ms
 ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 62ms
 ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1895ms
   ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 608ms
   ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 659ms
 ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 232ms
 ✓ src/components/commandPalette.test.tsx (3 tests) 31ms
 ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 130ms
 ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 53ms
 ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 54ms
 ✓ src/editor/__tests__/outline.test.ts (5 tests) 9ms
 ✓ src/components/minimap.test.tsx (4 tests) 60ms
 ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 140ms
 ✓ src/__tests__/headingNumbering.test.ts (2 tests) 3ms
 ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 12ms
 ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
 ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
 ✓ src/__tests__/App.test.tsx (57 tests) 5034ms
   ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 402ms
   ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 648ms
   ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 407ms

 Test Files  40 passed (40)
      Tests  451 passed | 3 skipped (454)
   Start at  21:52:16
   Duration  6.17s (transform 1.05s, setup 1.53s, collect 4.97s, tests 10.03s, environment 9.15s, prepare 1.77s)
  - Ran 
> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation.
  - No editor source changes were required in this pass; MF-051 behavior and regression coverage are already present in-tree.
- Verification:
  - 
> markflow@0.1.0 harness:start /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/start-session.mjs

MarkFlow harness session start
repo: /Users/pprp/Workspace/MarkFlow
branch: main

features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0

recent git log:
76203bd Preserve MF-051 protocol truthfulness while manual scroll-sync remains blocked
5264898 Preserve MF-051 protocol truthfulness while manual scroll-sync is blocked
c9939ce Defer MF-051 completion until trusted manual scroll-sync proof is available
342efb3 Close MF-051 session loop with truthful verification state and progress evidence
044ab4b Preserve MF-051 verification truthfulness with protocol-compliant session logging

latest progress entry:
### 2026-04-17 - MF-051 loop rerun (automation-only, manual scroll-sync blocked)

- Author: Codex
- Focus: one-feature protocol completion for `MF-051` in this session.
- What changed:
  - Re-ran `pnpm harness:start`.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran `MF-051` automated verification command:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Did not modify source or implementation files for the feature; no new code changes required in this round.
- Verification:
  - `pnpm harness:start` passed.
  - `./harness/init.sh --smoke` passed.
  - MF-051 automation passed: `40` test files, `451` tests passed, `3` skipped.
  - `pnpm harness:verify` passed (`features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0`).
- Remaining risk / blocker:
  - Trusted manual desktop verification for MF-051 active outline scrolling sync (scroll a multi-section document and confirm the active heading follows viewport) cannot be executed in this environment.
- Ledger decision:
  - Kept `harness/feature-ledger.json` unchanged (`MF-051.status=ready`, `MF-051.passes=false`, `MF-051.lastVerifiedAt=null`) to avoid false completion.
- Next recommended feature:
  - Continue with `MF-051` and complete trusted manual scroll-sync verification, then promote `status`, `passes`, `lastVerifiedAt` only after real proof.

next recommended feature:
MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation
status: ready | priority: 2 | area: @markflow/editor
depends on: MF-050
notes:
  Implemented on 2026-04-15 in `packages/editor/src/App.tsx` and `packages/editor/src/editor/MarkFlowEditor.tsx` by sourcing outline entries from the background symbol table, keeping heading additions/renames asynchronous, and combining explicit navigation intent with editor scroll events so the active outline item tracks the current section without blocking on full-document reparses. Automated coverage in `src/__tests__/App.test.tsx`, `src/editor/__tests__/MarkFlowEditor.test.tsx`, and `src/editor/__tests__/outline.test.ts` passed on 2026-04-15 with the listed editor test command. `passes` remains false because the manual desktop scroll-sync check is still pending. BUG (found 2026-04-16, detailed live-preview test, starter document): The active-heading indicator does NOT track scroll when the document fits the rendered viewport. `activeOutlineAnchor` is computed from `activeTab.cursorPosition ?? activeTab.viewportPosition ?? 0` (App.tsx ~line 1592), and `viewportPosition` is fed by `update.view.viewport.from` / `view.scrollDOM scroll handler` in `MarkFlowEditor.tsx` (~lines 303–310 and 603–606). But `view.viewport.from` is CodeMirror's virtualized range start, not the currently scrolled-to position — for a small doc `viewport.from` stays at 0 regardless of `scrollDOM.scrollTop`. Reproduced live: after `document.querySelector('.cm-scroller').scrollTop = 2000` on the starter document, `.mf-outline-item-active` remained on "Welcome to MarkFlow". On initial load the active outline item was the LAST heading ("Footnote") while `scrollTop` was 0 — symptom of an initial cursor/viewport value past the last heading. Fix should derive the active anchor from the topmost visible line, e.g. `view.posAtCoords({x: 0, y: view.documentTop})` or the line at `view.scrollDOM.scrollTop`, not `view.viewport.from`.
  
  ## Update 2026-04-17
  - Implemented in `packages/editor/src/App.tsx`:
    - tracks whether the active outline anchor source is the cursor (explicit selection/navigation) or viewport (scroll),
    - preserves the cursor-driven behavior by default and when switching tabs,
    - recomputes the active outline anchor from the selected source.
  - Implemented in `packages/editor/src/editor/MarkFlowEditor.tsx`:
    - reports viewport updates from the top visible editor position (`view.posAtCoords(...)`) instead of `view.viewport.from`.
  - Added/updated regression coverage in:
    - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx` (`viewport callback reports top visible position`),
    - `packages/editor/src/__tests__/App.test.tsx` (`scrolling view updates outline active heading`).
  - Required automated verification:
    - `pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts`
  - Manual verification remains pending in this environment because no trusted desktop UI session was available for this cycle; `passes` remains false and `lastVerifiedAt` unchanged until manual scroll-sync check is completed.
steps:
  1. Open any document with multiple heading levels.
  2. Confirm the outline panel updates as headings are added or removed.
  3. Click a heading in the panel and confirm the editor scrolls to that heading.
  4. Scroll the editor and confirm the active heading in the panel tracks the viewport.
automated verification:
  - pnpm --filter @markflow/editor test:run -- src/__tests__/App.test.tsx src/editor/__tests__/MarkFlowEditor.test.tsx src/editor/__tests__/outline.test.ts
manual verification:
  - Manual scroll-sync check with a multi-section document.

recommended loop:
1. ./harness/init.sh --smoke
2. implement one feature only
3. run targeted verification
4. update harness/feature-ledger.json and harness/progress.md
5. commit the session in a clean state: pass.
  - [harness] Repo: /Users/pprp/Workspace/MarkFlow

> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation

> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/desktop test:run$ vitest run --passWithNoTests
packages/editor test:run$ vitest run
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 16ms
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 5ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 7ms
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 4ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 2ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 10ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 13ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 117ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 184ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:23
packages/desktop test:run:    Duration  617ms (transform 260ms, setup 0ms, collect 818ms, tests 356ms, environment 1ms, prepare 726ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 46ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 90ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 104ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 55ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 157ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 111ms
packages/editor test:run: (node:33204) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 103ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 64ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 69ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 83ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 39ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 86ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 80ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 484ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 345ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 143ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 2ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 38ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 44ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 1868ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 492ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 717ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 48ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 171ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 32ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 232ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 59ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 12ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 196ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 122ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 72ms
packages/editor test:run: (node:33303) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 1ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 6ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 4ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 12ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5139ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 430ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 651ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 405ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:24
packages/editor test:run:    Duration  6.56s (transform 1.03s, setup 1.57s, collect 4.86s, tests 10.10s, environment 10.06s, prepare 2.11s)
packages/editor test:run: Done: pass (invokes full 
> markflow@0.1.0 test /Users/pprp/Workspace/MarkFlow
> pnpm -r run test:run

Scope: 3 of 4 workspace projects
packages/shared test:run$ vitest run --passWithNoTests
packages/shared test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/shared
packages/shared test:run: include: **/*.{test,spec}.?(c|m)[jt]s?(x)
packages/shared test:run: exclude:  **/node_modules/**, **/dist/**, **/cypress/**, **/.{idea,git,cache,output,temp}/**, **/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*
packages/shared test:run: No test files found, exiting with code 0
packages/shared test:run: Done
packages/desktop test:run$ vitest run --passWithNoTests
packages/editor test:run$ vitest run
packages/desktop test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/desktop
packages/editor test:run:  RUN  v2.1.9 /Users/pprp/Workspace/MarkFlow/packages/editor
packages/desktop test:run:  ✓ src/main/externalLinks.test.ts (4 tests) 4ms
packages/desktop test:run:  ✓ src/main/windowStateManager.test.ts (3 tests) 8ms
packages/desktop test:run:  ✓ src/main/themeManager.test.ts (3 tests) 187ms
packages/desktop test:run:  ✓ src/main/menu.test.ts (14 tests) 6ms
packages/desktop test:run:  ✓ src/main/search.test.ts (2 tests) 4ms
packages/desktop test:run:  ✓ src/main/spellCheckManager.test.ts (2 tests) 16ms
packages/desktop test:run:  ✓ src/main/vault.test.ts (5 tests) 13ms
packages/desktop test:run:  ✓ src/main/imageUploadManager.test.ts (3 tests) 19ms
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > exports HTML and reports a visible error when the target path is not writable
packages/desktop test:run: Failed to export HTML: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:609:84
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run: stderr | src/main/fileManager.test.ts > FileManager Pandoc exports > shows a PDF export error dialog when the final path is not writable
packages/desktop test:run: Failed to export PDF: Error: EACCES: permission denied
packages/desktop test:run:     at /Users/pprp/Workspace/MarkFlow/packages/desktop/src/main/fileManager.test.ts:663:30
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:146:14
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:533:11
packages/desktop test:run:     at runWithTimeout (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:39:7)
packages/desktop test:run:     at runTest (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1056:17)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runSuite (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1205:15)
packages/desktop test:run:     at runFiles (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1262:5)
packages/desktop test:run:     at startTests (file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/@vitest+runner@2.1.9/node_modules/@vitest/runner/dist/index.js:1271:3)
packages/desktop test:run:     at file:///Users/pprp/Workspace/MarkFlow/node_modules/.pnpm/vitest@2.1.9_@types+node@22.19.17_jsdom@25.0.1/node_modules/vitest/dist/chunks/runBaseTests.3qpJUEJM.js:126:11
packages/desktop test:run:  ✓ src/main/fileManager.test.ts (25 tests) 89ms
packages/desktop test:run:  Test Files  9 passed (9)
packages/desktop test:run:       Tests  61 passed (61)
packages/desktop test:run:    Start at  21:52:31
packages/desktop test:run:    Duration  628ms (transform 364ms, setup 0ms, collect 1.09s, tests 347ms, environment 1ms, prepare 835ms)
packages/desktop test:run: Done
packages/editor test:run:  ✓ src/editor/__tests__/inlineDecorations.test.tsx (16 tests) 56ms
packages/editor test:run:  ✓ src/editor/__tests__/tableCommands.test.ts (10 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.test.ts (55 tests) 93ms
packages/editor test:run:  ✓ src/editor/__tests__/indexer.test.ts (19 tests) 95ms
packages/editor test:run:  ✓ src/editor/__tests__/listAndBlockquoteDecoration.test.tsx (14 tests) 58ms
packages/editor test:run:  ✓ src/editor/__tests__/mermaidDecoration.test.ts (12 tests) 151ms
packages/editor test:run:  ✓ src/editor/__tests__/linkDecoration.test.tsx (9 tests) 104ms
packages/editor test:run: (node:33409) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/editor/__tests__/wordCount.test.ts (31 tests) 6ms
packages/editor test:run:  ✓ src/editor/__tests__/inlineHtmlDecoration.test.ts (6 tests) 79ms
packages/editor test:run:  ✓ src/editor/__tests__/mathDecoration.test.ts (20 tests) 109ms
packages/editor test:run:  ✓ src/editor/__tests__/tableDecoration.test.ts (5 tests) 94ms
packages/editor test:run:  ✓ src/editor/__tests__/codeBlockDecoration.test.ts (16 tests) 63ms
packages/editor test:run:  ✓ src/editor/__tests__/smartTypography.test.ts (11 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/findReplace.test.ts (7 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/yamlFrontMatter.test.ts (13 tests) 37ms
packages/editor test:run:  ✓ src/editor/__tests__/focusMode.test.ts (8 tests) 62ms
packages/editor test:run:  ✓ src/editor/__tests__/deleteRange.test.ts (9 tests) 82ms
packages/editor test:run:  ✓ src/editor/__tests__/virtualRendering.test.ts (6 tests) 135ms
packages/editor test:run:  ✓ src/editor/__tests__/footnoteDecoration.test.tsx (4 tests) 165ms
packages/editor test:run:  ✓ src/editor/__tests__/tocDecoration.test.tsx (8 tests) 625ms
packages/editor test:run:    ✓ toc decorations > uses the background symbol table for large documents instead of reparsing headings in the toc plugin 459ms
packages/editor test:run:  ✓ src/editor/__tests__/spellCheck.test.ts (5 tests) 34ms
packages/editor test:run:  ✓ src/editor/__tests__/navigationHistory.test.ts (4 tests) 10ms
packages/editor test:run:  ✓ src/editor/__tests__/lazyImage.test.tsx (3 tests) 74ms
packages/editor test:run:  ✓ src/export/htmlExport.test.ts (3 tests) 65ms
packages/editor test:run:  ✓ src/editor/__tests__/smartPaste.test.ts (4 tests) 31ms
packages/editor test:run:  ✓ src/editor/__tests__/folding.test.tsx (3 tests) 147ms
packages/editor test:run:  ✓ src/editor/__tests__/MarkFlowEditor.test.tsx (56 tests | 3 skipped) 2061ms
packages/editor test:run:    ✓ MarkFlowEditor > defers large-document onChange materialization until the editor is idle 666ms
packages/editor test:run:    ✓ MarkFlowEditor > caps undo history at 500 edit events and stops cleanly after that point 767ms
packages/editor test:run:  ✓ src/components/commandPalette.test.tsx (3 tests) 59ms
packages/editor test:run:  ✓ src/editor/__tests__/clearFormatting.test.ts (7 tests) 67ms
packages/editor test:run:  ✓ src/editor/__tests__/incrementalParse.test.tsx (2 tests) 34ms
packages/editor test:run:  ✓ src/editor/__tests__/emojiAutocomplete.test.ts (4 tests) 261ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownPostProcessor.test.tsx (2 tests) 146ms
packages/editor test:run:  ✓ src/editor/__tests__/outline.test.ts (5 tests) 11ms
packages/editor test:run:  ✓ src/editor/__tests__/smartInput.mac.test.ts (3 tests) 126ms
packages/editor test:run:  ✓ src/components/minimap.test.tsx (4 tests) 57ms
packages/editor test:run:  ✓ src/editor/__tests__/yCollab.test.ts (4 tests) 5ms
packages/editor test:run: (node:33513) Warning: `--localstorage-file` was provided without a valid path
packages/editor test:run: (Use `node --trace-warnings ...` to show where the warning was created)
packages/editor test:run:  ✓ src/__tests__/headingNumbering.test.ts (2 tests) 3ms
packages/editor test:run:  ✓ src/editor/__tests__/readingMode.test.ts (1 test) 13ms
packages/editor test:run:  ✓ src/editor/__tests__/markdownMode.test.ts (3 tests) 5ms
packages/editor test:run:  ✓ src/__tests__/App.test.tsx (57 tests) 5242ms
packages/editor test:run:    ✓ App desktop integration > saves the latest large-document editor content before deferred sync flushes 459ms
packages/editor test:run:    ✓ App desktop integration > keeps the outline in sync when headings are renamed or reordered 647ms
packages/editor test:run:    ✓ App command palette integration > pushes wikilink and global-search destinations onto navigation history across files 397ms
packages/editor test:run:  Test Files  40 passed (40)
packages/editor test:run:       Tests  451 passed | 3 skipped (454)
packages/editor test:run:    Start at  21:52:31
packages/editor test:run:    Duration  6.68s (transform 994ms, setup 1.60s, collect 5.07s, tests 10.64s, environment 10.41s, prepare 1.86s)
packages/editor test:run: Done).
  - feature command: pass ( test files,  tests,  skipped).
  - 
> markflow@0.1.0 harness:verify /Users/pprp/Workspace/MarkFlow
> node ./scripts/harness/verify.mjs

Harness verification passed.
features: 121 total | verified=66 | ready=39 | planned=15 | blocked=1 | regression=0
next: MF-051 - Outline panel lists all headings with live scroll-sync and click-to-jump navigation: pass ().
- Risks / blocker:
  - Trusted manual desktop scroll-sync verification for MF-051 is still not possible in this environment, so  cannot be marked true.
  - During full-suite test runs,  logs permission-related  stderr entries; they are environmental and did not fail tests.
- Ledger handling:
  - Kept  unchanged for  (, , ) to maintain truthfulness while manual verification is pending.
- Next recommended feature:
  - Continue  by completing trusted multi-section manual outline scroll-sync validation, then update  only after passing both automation and manual checks.

## 2026-04-19 - Aggressive bundle layout overhaul

- Summary:
  - Merged recent items and outline navigation into the left bundle rail in `packages/editor/src/components/VaultSidebar.tsx` and wired the rail from `packages/editor/src/App.tsx`.
  - Introduced a shared overlay shell in `packages/editor/src/components/OverlayScreen.tsx` and aligned Quick Open, Command Palette, Global Search, and Go To Line around the same header/body/footer structure.
  - Refreshed the starter document marketing surface in `packages/editor/src/app-shell/documents.ts` so the first-run experience speaks the new editorial bundle language and still exposes an early external link for link rendering coverage.
- Tests added or updated:
  - Added `packages/editor/src/components/QuickOpen.test.tsx`.
  - Expanded `packages/editor/src/components/VaultSidebar.test.tsx`, `packages/editor/src/components/commandPalette.test.tsx`, and `packages/editor/src/__tests__/App.test.tsx` to cover merged-rail and overlay-shell behavior.
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/components/VaultSidebar.test.tsx src/components/commandPalette.test.tsx src/components/QuickOpen.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor test:run`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
- Remaining risks:
  - There is no standalone docs/marketing site in this repo today, so the docs/marketing refresh in this pass is limited to the in-app starter surface.
  - The workspace already contains unrelated dirty changes in package manifests, desktop build artifacts, and `global.css`; this handoff does not normalize or revert them.

## 2026-04-19 - MF-053 fuzzy document search

- Author: Codex
- Focus: one-feature protocol completion for `MF-053` in this session.
- What changed:
  - Added a dedicated `Cmd/Ctrl+F` document-search bar in `packages/editor/src/components/DocumentSearch.tsx` and `DocumentSearch.css`.
  - Added fuzzy-search query compilation and async count helpers in `packages/editor/src/editor/documentSearch.ts` plus `documentSearch.worker.ts`.
  - Wired the App shell to open/close the document search bar, drive query state, and request async match counts in `packages/editor/src/App.tsx` and `packages/editor/src/app-shell/useSearchDialogs.ts`.
  - Extended `packages/editor/src/editor/MarkFlowEditor.tsx` with viewport-limited fuzzy highlight decorations and `Enter` / `Shift+Enter` next/previous navigation.
  - Added regression coverage in `packages/editor/src/editor/__tests__/documentSearch.test.ts` and `packages/editor/src/__tests__/App.test.tsx`.
- Simplifications made:
  - Reused the existing CodeMirror search-match visual classes instead of introducing a second highlight styling system.
  - Kept fuzzy search separate from the older replace flow, so `Cmd/Ctrl+H` behavior stayed intact.
  - Limited highlight decoration work to visible lines, matching the repo’s virtual-rendering strategy instead of scanning the whole DOM.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/documentSearch.test.ts src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor test:run -- --grep fuzzy-search`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
- Remaining risks:
  - Manual verification from `harness/features/MF-053.md` was not completed in a trusted live desktop session, so the large-file fixture behavior still lacks manual proof.
  - Fuzzy navigation currently selects the minimal regex span (for example `MarkF` for query `mf`) rather than expanding to the entire surrounding token; that is consistent with the implemented matcher, but worth revisiting if product expectations shift.
  - The workspace still contains unrelated pre-existing edits in `docs/editorial-chrome-cleanup-plan.md`, `packages/editor/src/components/VaultSidebar*`, and `packages/editor/src/styles/global.css`; this session did not modify or normalize those changes.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-053` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because automated verification passed but the required manual verification did not happen.
- Next recommended feature:
  - Continue `MF-053` with a trusted manual large-file verification pass, then update the ledger only after the live search-count check succeeds.

## 2026-04-19 - MF-053 live verification closeout

- Author: Codex
- Focus: finish the remaining manual verification gate for `MF-053` and update the harness state truthfully.
- What changed:
  - Did not modify the editor implementation.
  - Recorded live Electron verification evidence in `harness/features/MF-053.md`.
  - Promoted `MF-053` in `harness/feature-ledger.json` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-19T09:24:22Z`.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor test:run -- --grep fuzzy-search`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
  - Live Electron CDP probe on `harness/fixtures/mf-large-180k.md`:
    - query `Paragraph` produced `19` visible highlights in `7 ms`
    - the badge settled to `172504 matches` in `110 ms`
    - `Enter` moved the active selection from `Paragraph 7` to `Paragraph 8`
    - `Shift+Enter` returned the active selection to `Paragraph 7`
- Remaining risks:
  - `./harness/init.sh --smoke` still reports unrelated pre-existing failures in `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx` for split-pane flex-grow string formatting (`0.42` vs `0.42000000000000004`); this session did not change that code path.
  - The workspace still contains unrelated pre-existing edits outside the harness files touched here.
- Next recommended feature:
  - Re-run `pnpm harness:next` / `pnpm harness:verify` from the updated ledger and pick the new highest-priority `passes=false` item after this closeout commit lands.

## 2026-04-19 - Editorial chrome black tab follow-up

- Author: Codex
- Focus: remove the remaining dark active-tab/header surface mismatch reported in the desktop chrome.
- What changed:
  - Added dedicated desktop chrome surface tokens in `packages/editor/src/styles/global.css`.
  - Switched the titlebar, tabstrip, active tab pill, and active view-mode segment to those derived chrome surfaces instead of relying on `--mf-bg-elevated`.
- Simplifications made:
  - Kept the fix local to shared chrome CSS instead of expanding the theme manager contract.
  - Derived chrome colors from `--mf-bg` and `--mf-bg-secondary` so incomplete theme overrides cannot leave only the active tab dark.
- Verification:
  - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor build`
- Remaining risks:
  - I did not capture a trusted live Electron screenshot in this pass, so the final visual confirmation is still based on the CSS/token path plus automated verification.
  - The editor workspace already contains unrelated in-flight edits in `packages/editor/src/__tests__/App.test.tsx`, `packages/desktop/src/main/themeManager.ts`, and `packages/desktop/src/main/themeManager.test.ts`; this handoff did not normalize them.

## 2026-04-19 - MF-068 redo caret parity

- Author: Codex
- Focus: one-feature protocol completion attempt for `MF-068` in this session.
- What changed:
  - Fixed `packages/editor/src/editor/extensions/tableCommands.ts` so active-cell detection ignores the leading table pipe instead of shifting commands into the next column.
  - Added a mapped table-selection history effect in `packages/editor/src/editor/extensions/tableCommands.ts` so redo restores the intended row/cell selection after table commands.
  - Expanded `packages/editor/src/editor/__tests__/tableCommands.test.ts` to cover undo/redo selection parity for row insert, last-cell row append, row delete, row move, and column insert/delete.
- Simplifications made:
  - Kept the fix inside the existing table command extension instead of wiring separate undo/redo hooks through `MarkFlowEditor`.
  - Reused CodeMirror history/effect plumbing rather than adding command-specific redo branches for each table operation.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/tableCommands.test.ts`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
- Verification results:
  - Passed: `pnpm harness:start`
  - Failed, unrelated blocker: `./harness/init.sh --smoke` because `packages/desktop/src/main/themeManager.test.ts` is already broken by in-flight theme API changes outside `MF-068`.
  - Passed: `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/tableCommands.test.ts` (`10` tests)
  - Passed: `pnpm --filter @markflow/editor lint`
  - Failed, unrelated blocker: `pnpm --filter @markflow/editor build` because `packages/editor/src/__tests__/App.test.tsx` still expects stale `MarkFlowDesktopAPI` and `MarkFlowThemeState` fields from the same theme API drift.
  - Passed: `pnpm harness:verify`
- Remaining risks:
  - Manual verification from `harness/features/MF-068.md` was not completed in a trusted desktop session, so caret behavior across repeated live table edits and source/WYSIWYG switching still lacks manual proof.
  - Workspace-wide smoke/build health is currently blocked by unrelated theme work in `packages/desktop/src/main/themeManager*`, `packages/editor/src/__tests__/App.test.tsx`, and shared theme API surfaces; this session did not change those files.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-068` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual verification is still pending and unrelated workspace blockers prevent a truthful full-green closeout.
- Next recommended feature:
  - Continue `MF-068` by running the required manual large-table verification in a trusted desktop session after the unrelated theme API/build blockers are resolved, then update the ledger only if both manual proof and clean verification are real.

## 2026-04-19 - MF-074 live verification closeout

- Author: Codex
- Focus: finish the remaining manual verification gate for `MF-074` and update the harness state truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-074.md` with live packaged-Electron verification evidence for navigation, view, insert, edit, and export commands.
  - Updated `harness/feature-ledger.json` to promote `MF-074` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-19T12:22:44.211Z`.
  - Appended this session handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing packaged-app plus CDP verification path instead of introducing a new repo-side harness or helper script.
  - Kept the export proof on the real entry-and-cancel path (`Esc`) rather than writing a throwaway exported file, because the feature gate is command-palette invocation and the existing automated export tests already cover serialization and IPC payloads.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm desktop:pack`
  - `pnpm --filter @markflow/editor exec vitest run src/components/commandPalette.test.tsx src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/editor exec eslint src/App.tsx src/editor/MarkFlowEditor.tsx src/editor/extensions/smartInput.ts src/components/CommandPalette.tsx src/components/commandPaletteRegistry.ts src/components/commandPalette.test.tsx`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
  - Live packaged Electron CDP probe on `/tmp/mf074-live.md` under isolated `HOME=/tmp/mf074-home-*` state:
    - Navigation: `quick op` opened Quick Open and listed `/tmp` entries including `mf074-live.md`.
    - View: `tog foc` enabled focus mode (`.mf-focus-mode`).
    - Insert: `ins tab` inserted the 3-row table scaffold at the active paragraph.
    - Edit: `undo` removed the scaffold and restored `Alpha beta gamma paragraph.` as the active line.
    - Export: `exp h` entered the HTML export path with `#mf-export-container` mounted and cleared cleanly after native `Esc` cancellation.
- Remaining risks:
  - The live closeout verified the export command's entry and cancellation path rather than completing a real file write; HTML serialization and export IPC payloads remain covered by the existing `App export integration` automation, not this manual pass.
  - The workspace still contains unrelated pre-existing dirty changes in theme/menu/shared files; this session did not normalize or revert them.
- Next recommended feature:
  - `MF-075` - Copy writes rich clipboard formats, while Copy as Markdown and Copy as HTML Code expose source formats.

## 2026-04-19 - MF-075 live verification closeout

- Author: Codex
- Focus: finish the remaining manual verification gate for `MF-075` and update the harness state truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-075.md` with live packaged-Electron clipboard verification evidence.
  - Updated `harness/feature-ledger.json` to promote `MF-075` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-19T12:51:23Z`.
  - Appended this session handoff to `harness/progress.md`.
- Simplifications made:
  - Reused a packaged-app CDP probe plus `clipboard info` introspection instead of adding a repo-side clipboard harness.
  - Used TextEdit in rich-text and plain-text modes as the external clipboard consumers so the proof stayed on real macOS targets.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx`
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
  - `pnpm desktop:pack`
  - Live packaged Electron CDP probe on `/tmp/markflow-mf075-app/MarkFlow.app` under isolated `--user-data-dir=/tmp/mf075-profile-*` state:
    - `Copy` wrote rendered plain text `Before bold link and code` and exposed `«class HTML»` on the system clipboard.
    - Pasting `Copy` into a rich TextEdit document and copying it back yielded `«class RTF »`, confirming a real rich-text target consumed the payload.
    - Pasting `Copy` into a plain-text TextEdit document preserved only utf8/plain-text data with value `Before bold link and code`.
    - `Copy as Markdown` pasted `Before **bold** [link](https://example.com) and \`code\`` into the plain-text TextEdit target.
    - `Copy as HTML Code` pasted `<p>Before <strong>bold</strong> <a href="https://example.com">link</a> and <code>code</code></p>` into the plain-text TextEdit target.
- Remaining risks:
  - The live manual proof used TextEdit for both the rich-text and plain-text targets; I did not cross-check a second rich-text consumer such as Notes or Mail in this session.
  - The workspace still contains unrelated pre-existing dirty changes in theme/sidebar/shared files; this session did not normalize or revert them.
- Next recommended feature:
  - Re-run `pnpm harness:next` from the updated ledger and pick the new highest-priority `passes=false` feature after this closeout commit lands.

## 2026-04-19 - MF-076 verification loop (automation pass, manual Word gate blocked)

- Author: Codex
- Focus: strict one-feature loop for `MF-076` under the current workspace constraints.
- What changed:
  - Ran `pnpm harness:start`.
  - Ran `./harness/init.sh --smoke`.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Ran `pnpm harness:verify`.
  - Updated `harness/features/MF-076.md` and `harness/progress.md` with the current verification state and blocker details.
- Simplifications made:
  - Did not touch the existing `smartPaste` implementation or its tests because the feature behavior and automated coverage were already green on the current tree.
  - Refused to substitute `Pages` for `Word`; the feature note now records the exact missing acceptance precondition instead of overstating completion.
- Verification:
  - `pnpm harness:start` passed and continued to point at `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `4` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`).
- Remaining risks:
  - The required manual acceptance for `MF-076` is still open. The feature spec calls for paste comparisons from Microsoft Word, a webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`; this machine does not have `Microsoft Word.app`, so that checklist cannot be completed truthfully here.
  - Native desktop app-control tooling is not reliable in this session (`Computer Use` app enumeration returned Apple event error `-1743`), which also prevents a trustworthy native-app fallback for the missing Word path.
  - The workspace still contains unrelated pre-existing dirty changes in desktop/theme/sidebar/shared files; this session did not normalize or revert them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` only in a session that has `Microsoft Word.app` installed plus trusted native desktop UI control, then repeat the manual three-source paste comparison before promoting the ledger.

## 2026-04-19 - MF-076 coverage tightening (manual Word gate still blocked)

- Author: Codex
- Focus: keep this session on `MF-076` only, tighten the missing shortcut/reset regression coverage, and refresh the blocker record without overstating completion.
- What changed:
  - Expanded `packages/editor/src/editor/__tests__/smartPaste.test.ts` with three additional `MF-076` regression cases:
    - `Cmd+Shift+V` (`metaKey`) uses the plain-text path.
    - editor `blur` clears the pending plain-text paste intent.
    - the 1-second shortcut window expires back to the default HTML-to-Markdown paste path.
  - Updated `harness/features/MF-076.md` and appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing test helpers and current `smartPaste` implementation; no production editor code changed.
  - Kept `harness/feature-ledger.json` untouched because the remaining blocker is still manual acceptance, not automated behavior.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`).
  - Manual verification remained blocked: `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results, and `/Applications` only exposed `Safari.app` plus `Visual Studio Code.app` among the required external sources.
- Remaining risks:
  - The required `MF-076` acceptance proof is still incomplete because the feature spec requires comparisons from Microsoft Word, a webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The workspace still contains unrelated pre-existing dirty changes in desktop/theme/sidebar/shared files; this session did not normalize or revert them.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual acceptance gate is still blocked.
- Next recommended feature:
  - Continue `MF-076` on a machine that has `Microsoft Word.app` installed, then reuse the packaged-app/CDP verification path plus real Word, webpage, and VS Code paste comparisons before promoting the ledger.

## 2026-04-19 - MF-076 webpage live evidence, Word/plain-text matrix still blocked

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required automation, and push the manual acceptance evidence as far as the current machine allows without overstating completion.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with packaged-app webpage clipboard evidence and narrower blocker details.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing packaged-app plus CDP path and native clipboard/keystroke flows instead of adding a repo-side helper script.
  - Refused to count split shortcut/paste probes as manual proof for `Cmd+Shift+V`; they are diagnostic evidence only.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm desktop:pack`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
  - `pnpm --filter @markflow/editor lint`
  - `pnpm --filter @markflow/editor build`
  - `pnpm harness:verify`
  - Live packaged Electron + browser clipboard probe:
    - A real `Microsoft Edge` page copy exposed `«class HTML»` plus plain-text clipboard flavors for `Bold link and code`.
    - Native `Cmd+V` into the packaged MarkFlow app saved `**Bold** [link](https://example.com/) and \`code\`` to disk, confirming the default webpage paste path still follows the HTML-to-markdown route.
    - Native `Cmd+Shift+V` desktop automation did not produce a trustworthy paste event, and both split probes still saved the default markdown conversion, so the webpage plain-text step remains unverified.
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - A `Code` source probe did not yield stable clipboard evidence, so the VS Code source remains unverified.
- Remaining risks:
  - The required manual acceptance matrix is still incomplete: Word is unavailable, the webpage plain-text shortcut path could not be truthfully proven with native desktop automation, and the VS Code source still lacks live clipboard evidence.
  - The browser-source proof used `Microsoft Edge` rather than Safari; that is sufficient to validate one real webpage source, but it does not close the full three-source matrix on its own.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual acceptance is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a session that has `Microsoft Word.app` installed and trusted native shortcut control, then complete the remaining webpage plain-text and VS Code comparisons before promoting the ledger.

## 2026-04-20 - MF-076 verification rerun, Word environment gate still blocking

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required verification on the current tree, and record the remaining acceptance blocker truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's verification rerun and environment-gate result.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing targeted `smartPaste` test/lint/build verification instead of widening scope to unrelated editor or desktop work.
  - Stopped short of re-running partial packaged-app clipboard probes once the missing `Microsoft Word.app` check conclusively kept the acceptance matrix incomplete.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate check: `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results, and `/Applications` only exposed `Microsoft Edge.app`, `Safari.app`, and `Visual Studio Code.app` among the required external sources.
- Remaining risks:
  - The required manual acceptance is still incomplete because the feature spec calls for Word, webpage, and VS Code paste comparisons with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The existing partial live webpage and VS Code evidence from 2026-04-19 is still insufficient to close the full matrix and was not reused to overstate completion.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the full manual acceptance gate remains blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, targeted automation green and Word gate unchanged

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required closeout loop, and record today's still-active manual verification blocker without overstating completion.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with a second 2026-04-20 verification rerun note.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and current harness smoke flow instead of widening scope to unrelated packages or features.
  - Stopped at the environment gate once `Microsoft Word.app` was confirmed absent, because any partial webpage/VS Code rerun would still be insufficient for the required three-source manual matrix.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Microsoft Edge.app` and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because the feature spec requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - I did not rerun the earlier packaged-app clipboard probes today, because the missing Word source already prevents truthful promotion and partial evidence would not change the ledger decision.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-20T15:39:06+08:00 - MF-076 closeout rerun, automation still green and the manual gate is still blocked

- Author: Codex
- Focus: stay on `MF-076` only, refresh the required evidence on the current tree, and record the remaining blocker truthfully without widening scope.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Re-ran the required session-start protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
    - `Computer Use` app enumeration
  - Updated `harness/features/MF-076.md` with the current blocker state and appended this handoff.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` automated verification path instead of touching already-green implementation or tests.
  - Kept the ledger unchanged because the missing manual evidence is environmental, not a code-state change.
- Verification:
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files / `65` tests passed.
    - `packages/editor`: `43` test files / `467` tests passed / `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file / `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed verification / blocker:
  - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
  - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort` returned only `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`.
  - `Computer Use` app enumeration failed with `Apple event error -1743: Unknown error`, so this session still cannot complete trustworthy native desktop fallback verification.
- Remaining risks:
  - `MF-076` still lacks the required Word/webpage/VS Code manual matrix with and without `Cmd/Ctrl+Shift+V`.
  - Existing partial 2026-04-19 webpage and VS Code evidence still does not justify setting `passes=true` without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`).
- Next recommended feature:
  - Continue `MF-076` only in a trusted desktop session that has `Microsoft Word.app` installed and working native app control, then finish the full manual matrix before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, automation green and Word gate still blocks completion

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required verification on the current tree, and record the still-blocked manual acceptance truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's sixth 2026-04-20 rerun note.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Did not rerun partial live webpage/VS Code clipboard probes, because the missing `Microsoft Word.app` source already keeps the required three-source matrix incomplete and would not change the ledger decision.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The earlier partial live webpage and VS Code evidence still does not close the matrix without the missing Word source and the missing fresh plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, automation still green and Word still absent

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required feature verification on the current tree, and write today's environment blocker back to the repo truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's verification rerun and environment evidence.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing `smartPaste` regression test, editor lint, editor build, and harness smoke/verify flow instead of widening scope beyond `MF-076`.
  - Did not rerun partial packaged-app clipboard probes, because the missing `Microsoft Word.app` source already prevents honest promotion and extra partial evidence would not change the ledger decision.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke`
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because the feature spec requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, smoke and targeted verification still green

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required startup and verification loop, and record the still-blocked manual acceptance truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with a fourth 2026-04-20 verification rerun note.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Simplifications made:
  - Reused the existing `smartPaste` regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the Word environment gate instead of rerunning partial clipboard probes that still could not complete the required three-source manual matrix.
- Verification:
  - `pnpm harness:start` passed and continued to point at `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The existing partial live webpage and VS Code evidence remains insufficient to promote the ledger without the missing Word and plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, Word gate still blocks truthful promotion

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun its required verification on the current tree, and write the still-blocked manual gate back to the repo without overstating completion.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's fifth rerun note and current environment evidence.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the missing-Word environment gate instead of rerunning partial packaged-app clipboard probes that still could not satisfy the required three-source manual matrix.
- Verification:
  - `pnpm harness:start`
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The existing partial live webpage and VS Code evidence remains insufficient to promote the ledger without the missing Word and plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, targeted automation still green and Word gate remains open

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required closeout verification on the current tree, and write today's blocker state back to the repo truthfully.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's seventh 2026-04-20 rerun note.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression test and required editor lint/build plus harness verification flow instead of widening scope or rerunning partial clipboard probes that still cannot satisfy the manual matrix without Word.
- Verification:
  - `pnpm harness:start` passed and continued to point at `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20 - MF-076 closeout rerun, targeted verification green and Word still missing

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun its required verification on the current tree, and write the still-blocked manual gate back to the repo without overstating completion.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's eighth rerun note.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the missing-Word environment gate instead of rerunning partial webpage and VS Code clipboard probes that still cannot satisfy the required three-source matrix.
- Verification:
  - `pnpm harness:start` completed at session start.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20T05:46:30Z - MF-076 closeout rerun, automation green and Word still absent

- Author: Codex
- Focus: keep this session on `MF-076` only, rerun the required verification on the current tree, and record the still-blocked manual acceptance truthfully before closing the session.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's ninth 2026-04-20 rerun note and latest environment re-check.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the missing-Word environment gate instead of rerunning partial webpage and VS Code clipboard probes that still cannot satisfy the required three-source matrix.
- Verification:
  - `pnpm harness:start` completed at session start.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20T13:53:30+08:00 - MF-076 closeout rerun, automation green and Word gate still blocking manual proof

- Author: Codex
- Focus: keep this session on `MF-076` only, re-run its required verification on the current tree, and write the still-blocked manual gate back to the repo without overstating completion.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's tenth rerun note and latest environment re-check.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the missing-Word environment gate instead of rerunning partial clipboard probes that still cannot satisfy the required Word/webpage/VS Code manual matrix.
- Verification:
  - `pnpm harness:start` completed at session start and still pointed at `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, `Safari.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

## 2026-04-20T14:05:53+08:00 - MF-076 closeout rerun, required automation green and Word gate unchanged

- Author: Codex
- Focus: keep this session on `MF-076` only, re-run its required verification on the current tree, and record the still-blocked manual acceptance truthfully before closing the session.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Updated `harness/features/MF-076.md` with today's twelfth rerun note and latest environment re-check.
  - Left `harness/feature-ledger.json` unchanged.
  - Appended this handoff to `harness/progress.md`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of widening scope beyond `MF-076`.
  - Stopped at the missing-Word environment gate instead of re-running partial clipboard probes that still cannot satisfy the required Word/webpage/VS Code manual matrix.
- Verification:
  - `pnpm harness:start` completed at session start and still pointed at `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `/Applications` exposed `Codex.app`, `Microsoft Edge.app`, `Microsoft Outlook.app`, `Microsoft PowerPoint.app`, and `Visual Studio Code.app`, but no `Microsoft Word.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-20T14:56:14+08:00 - MF-076 closeout rerun, required automation green and Word gate still blocks honest completion

- Author: Codex
- Focus: keep this session on `MF-076` only, re-run its required verification on the current tree, and record the still-blocked manual gate truthfully before closing the session.
- What changed:
  - Re-ran `pnpm harness:start` at session start.
  - Re-ran `./harness/init.sh --smoke`.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` and appended this handoff to `harness/progress.md`; left `harness/feature-ledger.json` unchanged.
- Verification:
  - `./harness/init.sh --smoke` passed on the current tree (`packages/desktop`: `10` test files / `65` tests; `packages/editor`: `43` test files / `467` tests / `3` skipped).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - `pnpm harness:start` still printed an old `MF-051` progress excerpt from `harness/progress.md`, so feature selection for this session was reconciled against `harness/feature-ledger.json` and the successful `pnpm harness:verify` result instead of that stale excerpt.
- Remaining risk / blocker:
  - The required manual acceptance for `MF-076` is still incomplete because the feature note requires paste comparisons from Microsoft Word, a webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still has no `Microsoft Word.app`.
  - The latest environment re-check found only `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app` among the required external sources.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the full manual acceptance matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-20T15:13:45+08:00 - MF-076 closeout rerun, automation still green and Word gate remains the only blocker

- Author: Codex
- Focus: keep this session on `MF-076` only, re-run the required closeout verification on the current tree, and record the still-blocked manual acceptance state without widening scope.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Re-ran `pnpm harness:start` and `./harness/init.sh --smoke` at session start.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` and appended this handoff; left `harness/feature-ledger.json` unchanged.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of touching already-green implementation or widening scope.
  - Stopped at the missing-Word environment gate instead of rerunning partial clipboard probes that still cannot satisfy the required Word/webpage/VS Code manual matrix.
- Verification:
  - `pnpm harness:start` completed at session start and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort` returned `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-20T15:19:52+08:00 - MF-076 closeout rerun, automation green again and the Word gate still blocks truthful completion

- Author: Codex
- Focus: keep this session on `MF-076` only, re-run the required closeout verification on the current tree, and record the still-blocked manual acceptance state without widening scope.
- What changed:
  - Did not modify the editor or desktop implementation.
  - Re-ran `pnpm harness:start` and `./harness/init.sh --smoke` at session start.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual acceptance environment gate with:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` and appended this handoff; left `harness/feature-ledger.json` unchanged.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` targeted regression test plus the required editor lint/build and harness verification flow instead of widening scope or touching already-green implementation.
  - Stopped at the missing-Word environment gate instead of trying to infer completion from the older partial webpage and VS Code probes.
- Verification:
  - `pnpm harness:start` completed at session start and still selected `MF-076`.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `65` tests passed.
    - `packages/editor`: `43` test files, `467` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed.
  - `pnpm harness:verify` passed (`features: 121 total | verified=75 | ready=30 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort` returned `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Word, webpage, and VS Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - Existing partial webpage and VS Code evidence still does not justify promoting the ledger without the missing Word source and a trustworthy plain-text-shortcut proof.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the required manual matrix is still incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session that has `Microsoft Word.app` installed, then complete the with-and-without-shortcut comparisons across Word, webpage, and VS Code before promoting the ledger.

### 2026-04-21T12:54:22+08:00 - MF-123 untitled Save now prompts instead of reusing the previous file path

- Author: Codex
- Focus: implement only `MF-123`, covering Save behavior for an active untitled tab after an existing saved document has been opened.
- What changed:
  - Updated renderer Save routing so `File > Save` / `Cmd/Ctrl+S` on an untitled active tab uses the Save As bridge with the active tab content and tab id.
  - Updated desktop session handling so an active untitled tab preserves `activeFilePath: null` instead of falling back to the first saved tab path; `saveFile` can then fall through to the native save dialog with `untitled.md`.
  - Added desktop file-manager coverage proving the old file is not overwritten, the save dialog is shown, the selected path is written, `file-saved` is emitted, and the chosen path is recorded.
  - Added renderer coverage proving Save on an active untitled tab sends the active tab content and tab id through `saveFileAs`.
  - Made a minimal prerequisite focus fix for the existing document-search regression so full `App.test.tsx` and smoke verification can complete reliably.
- Changed files:
  - `packages/desktop/src/main/fileManager.ts`
  - `packages/desktop/src/main/fileManager.test.ts`
  - `packages/editor/src/App.tsx`
  - `packages/editor/src/__tests__/App.test.tsx`
  - `packages/editor/src/components/DocumentSearch.tsx`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing Save As IPC path instead of adding a new API or desktop-side tab-path map.
  - Kept desktop state changes limited to preserving the renderer's `activeFilePath: null` signal for untitled active tabs.
- Verification:
  - Session start:
    - `pnpm harness:start` passed and selected `MF-123`.
    - Initial `./harness/init.sh --smoke` failed in the existing document-search focus regression; the new focused search test passed by itself, confirming a full-suite isolation/timing issue.
  - Red tests before implementation:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts -t "prompts for a target when saving an active untitled"` failed because Save reused `original.md`.
    - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx -t "routes Save for an active untitled tab"` failed because Save did not call `saveFileAs`.
  - Feature automated verification after implementation:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts -t "prompts for a target when saving an active untitled"` passed.
    - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx -t "routes Save for an active untitled tab"` passed.
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts` passed (`26` tests).
    - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx` passed (`61` tests).
  - Additional verification:
    - `pnpm --filter @markflow/desktop lint` passed.
    - `pnpm --filter @markflow/editor lint` passed.
    - `pnpm --filter @markflow/desktop build` passed.
    - `pnpm --filter @markflow/editor build` passed with the existing Vite chunk-size warning.
    - Re-run `./harness/init.sh --smoke` passed:
      - `packages/desktop`: `10` test files, `66` tests passed.
      - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
    - Final `pnpm harness:verify` passed (`features: 123 total | verified=75 | ready=32 | planned=15 | blocked=1 | regression=0`; next: `MF-123`).
- Manual verification:
  - Not completed. A MarkFlow GUI session is already running against user state with existing open/dirty tabs, so I did not use it for native save-dialog testing or risk modifying that session.
- Remaining risks:
  - The native desktop save-dialog workflow still needs an isolated manual pass: open an existing saved file, create a new untitled file, save it to a different folder/name, confirm the original file is unchanged, and reopen the new file.
  - Because manual verification is incomplete, `harness/feature-ledger.json` was intentionally left unchanged for `MF-123` (`status=ready`, `passes=false`, `lastVerifiedAt=null`).
- Next recommended feature:
  - Continue `MF-123` in an isolated desktop app session and complete the listed manual verification before promoting the ledger to verified.

### 2026-04-21T13:17:12+08:00 - MF-123 manual closeout remains blocked by native save-panel state

- Author: Codex
- Focus: continue only `MF-123` from the current harness-selected feature; no second feature was implemented.
- What changed:
  - No product source changes in this closeout pass.
  - Re-ran the required startup, smoke, targeted automated verification, and an isolated desktop manual attempt for `MF-123`.
  - Left `harness/feature-ledger.json` unchanged because the manual gate still did not complete.
- Manual verification attempt:
  - Created `/tmp/markflow-mf123-manual/existing/original.md` and verified its starting SHA-256 as `9d3ee04c146697a747d1dfff713a9db8ae83ae1c8a4d3ad1aef31ebdcc94437b`.
  - Launched a dev Electron instance with isolated `--user-data-dir` and an isolated temp path. A first isolation attempt showed the global MarkFlow recovery checkpoint prompt; I did not click Cancel or OK because Cancel would delete that unrelated recovery checkpoint.
  - Opened the existing fixture in the desktop app, created a dirty `Untitled 2` tab with `Cmd+N`, typed `# MF-123 Manual Save`, then triggered Save with `Cmd+S`.
  - Confirmed the native Save panel opened from the untitled tab with default filename `untitled.md` and the Markdown file type selected.
  - Attempted to choose `/tmp/markflow-mf123-manual/output` and filename `untitled-saved.md`, but the native Save and New Folder buttons remained disabled across collapsed/expanded panel states and multiple folder choices. The panel could not complete the write in this environment.
  - Rechecked the original fixture SHA-256 after the attempt; it remained `9d3ee04c146697a747d1dfff713a9db8ae83ae1c8a4d3ad1aef31ebdcc94437b`.
  - Confirmed `/tmp/markflow-mf123-manual/output/untitled-saved.md` was not created.
- Verification:
  - `pnpm harness:start` passed and selected `MF-123`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `66` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/desktop build` passed before the manual desktop attempt.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts -t "prompts for a target when saving an active untitled"` passed (`1` test, `25` skipped).
  - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx -t "routes Save for an active untitled tab"` passed (`1` test, `60` skipped).
- Remaining risks:
  - Native manual verification is still incomplete because the dev Electron Save panel would open but would not enable the final Save action in this environment.
  - `MF-123` should not be promoted until a trusted desktop session can complete the full save: choose a folder/name, write the file, confirm the active tab title/path updates, reopen the file, and confirm the prior `original.md` remains unchanged.
  - The workspace still contains unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/styles/global.css`, `docs/logos/`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Ledger decision:
  - Kept `harness/feature-ledger.json` truthful for `MF-123` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual verification did not complete.
- Next recommended feature:
  - Continue `MF-123` only in a desktop environment where the native Save panel can complete the final write, then promote the ledger only after both automated and manual checks are green.

### 2026-04-21T13:33:10+08:00 - MF-123 verified after isolated native save pass

- Author: Codex
- Focus: finish only `MF-123`; no second feature was implemented.
- What changed:
  - Added `MARKFLOW_HARNESS_TEMP_DIR` and `MARKFLOW_HARNESS_USER_DATA_DIR` support in `FileManager` so manual desktop verification can run against isolated recovery/session storage instead of global app state.
  - Added desktop coverage proving those harness storage overrides are honored for recovery checkpoints and session state.
  - Promoted `MF-123` in `harness/feature-ledger.json` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-21T13:33:10+08:00`.
- Changed files:
  - `harness/features/MF-123.md`
  - `packages/desktop/src/main/fileManager.ts`
  - `packages/desktop/src/main/fileManager.test.ts`
  - `harness/feature-ledger.json`
  - `harness/progress.md`
- Simplifications made:
  - Kept the isolation hook to two explicit harness environment variables instead of adding a new app setting or changing normal Electron storage paths.
  - Reused the existing native Save As path for the manual proof; no new save API was introduced.
- Verification:
  - Startup:
    - `pnpm harness:start` passed and selected `MF-123`.
    - `./harness/init.sh --smoke` passed (`packages/desktop`: `66` tests; `packages/editor`: `468` passed, `3` skipped).
  - TDD check for the prerequisite isolation fix:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts -t "uses harness storage path overrides"` failed before implementation because recovery/session paths still used `/tmp`.
    - The same command passed after implementation.
  - Feature automated verification:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts -t "prompts for a target when saving an active untitled"` passed.
    - `pnpm --filter @markflow/editor exec vitest run src/__tests__/App.test.tsx -t "routes Save for an active untitled tab"` passed.
    - `pnpm --filter @markflow/desktop exec vitest run src/main/fileManager.test.ts` passed (`27` tests).
  - Additional verification:
    - `pnpm --filter @markflow/desktop lint` passed.
    - `pnpm --filter @markflow/desktop build` passed.
    - `pnpm harness:verify` passed after ledger promotion (`features: 123 total | verified=76 | ready=31 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Manual verification:
  - Created `/tmp/markflow-mf123-manual-501/existing/original.md` with SHA-256 `a9a525098771c8da9ecf97e12f6799094bf1271472caeeabe8b8a1e2fbf0a7f3`.
  - Launched dev Electron with isolated `MARKFLOW_HARNESS_TEMP_DIR=/tmp/markflow-mf123-manual-501/tmp` and `MARKFLOW_HARNESS_USER_DATA_DIR=/tmp/markflow-mf123-manual-501/user-data`; no global recovery prompt appeared.
  - Opened `original.md`, created `Untitled 2`, entered `# MF-123 Manual Save` plus body text, and pressed `Cmd+S`.
  - Confirmed the native Save panel opened from the untitled tab with default filename `untitled.md` and Markdown format selected.
  - Saved as `/tmp/markflow-mf123-manual-501/output/untitled-saved.md`; the active window/tab title changed to `untitled-saved.md`.
  - Reopened `untitled-saved.md` through the native Open panel and confirmed the rendered content matched the saved buffer.
  - Verified the original file SHA-256 stayed `a9a525098771c8da9ecf97e12f6799094bf1271472caeeabe8b8a1e2fbf0a7f3` and the saved file contained:
    - `# MF-123 Manual Save`
    - `Saved from an untitled tab.`
- Remaining risks:
  - Normal app behavior is unchanged unless the two `MARKFLOW_HARNESS_*` variables are set.
  - The workspace still has unrelated pre-existing edits in `.claude/launch.json`, `README.md`, `build.sh`, `packages/desktop/electron-builder.yml`, `packages/editor/src/App.tsx`, `packages/editor/src/__tests__/App.test.tsx`, `packages/editor/src/components/DocumentSearch.tsx`, `packages/editor/src/editor/MarkFlowEditor.tsx`, `packages/editor/src/styles/global.css`, `docs/logos/`, `harness/features/MF-122.md`, and `packages/desktop/build/entitlements.mac.plist`; this session did not normalize them.
- Next recommended feature:
  - `MF-076` - Paste as plain text shortcut strips rich formatting before insertion.

### 2026-04-21T13:47:32+08:00 - MF-076 automation remains green; Word-gated manual matrix still blocks completion

- Author: Codex
- Focus: continue only `MF-076` from the harness-selected next feature; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made in this session.
  - Re-ran `pnpm harness:start` and `./harness/init.sh --smoke` at session start.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the required manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the current verification and blocker state; left `harness/feature-ledger.json` unchanged for `MF-076`.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing focused `smartPaste` regression suite plus editor lint/build and harness verification instead of touching already-green implementation.
  - Stopped at the missing-Word gate instead of inferring completion from partial webpage/VS Code evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076` as the next recommended feature.
  - `./harness/init.sh --smoke` passed on the current tree:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 123 total | verified=76 | ready=31 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Environment gate checks:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `find /Applications ~/Applications -maxdepth 3 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort` returned `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - The ledger must not be promoted from partial automation-only evidence; `passes` remains `false` until the full trusted desktop matrix completes.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual verification matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T13:53:36+08:00 - MF-076 rerun remains automation-green; Word gate still blocks truthful completion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \)`
    - `Computer Use` app enumeration.
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of touching already-green implementation.
  - Stopped at the missing-Word manual gate rather than promoting the ledger from automation-only proof.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 123 total | verified=76 | ready=31 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
    - `Computer Use` listed Edge, VS Code, Safari, Outlook, PowerPoint, and MarkFlow, but no Microsoft Word.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`, and this machine still lacks `Microsoft Word.app`.
  - `harness/feature-ledger.json` still has unrelated pre-existing changes adding `MF-122`; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T14:25:31+08:00 - MF-124 split preview hides the first heading marker

- Author: Codex
- Focus: strict one-feature session for `MF-124`; no second feature was implemented.
- What changed:
  - Added a regression test for a non-editable split-preview-like `EditorView` whose selection starts at position `0`.
  - Updated WYSIWYG heading decoration logic so cursor-position markdown reveal only applies when the editor is editable.
  - Promoted `MF-124` in `harness/feature-ledger.json` only after automated and manual verification passed.
- Changed files:
  - `packages/editor/src/editor/decorations/inlineDecorations.ts`
  - `packages/editor/src/editor/__tests__/inlineDecorations.test.tsx`
  - `harness/feature-ledger.json`
  - `harness/features/MF-124.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing heading decoration path and CodeMirror `EditorView.editable` facet instead of adding split-view-specific state.
  - Kept the fix scoped to heading marker reveal behavior; no unrelated split-view backlog items were touched.
- Verification:
  - `pnpm harness:start` passed and selected `MF-124`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `468` tests passed, `3` skipped.
  - RED check passed by failing as expected before the implementation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/inlineDecorations.test.tsx -t "hides the first heading marker"` failed with expected `# MarkFlow` vs `MarkFlow`.
  - GREEN and regression verification passed:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/inlineDecorations.test.tsx -t "hides the first heading marker"` passed.
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/inlineDecorations.test.tsx` passed (`17` tests).
    - `pnpm --filter @markflow/editor test:run` passed (`43` test files, `469` tests passed, `3` skipped).
    - `pnpm --filter @markflow/editor lint` passed.
    - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
    - `pnpm harness:verify` passed (`features: 135 total | verified=77 | ready=42 | planned=15 | blocked=1 | regression=0`; next: `MF-125`).
  - Manual verification via Vite + Playwright on Microsoft Edge:
    - In Split view, `.mf-split-pane-preview .cm-line:first` returned `MarkFlow` with no leading `#`.
    - The source pane still showed raw `# MarkFlow`.
    - After clicking another line in the source pane, the preview first heading still returned `MarkFlow`.
- Remaining risks:
  - Build still reports the pre-existing Vite large-chunk warning.
  - Playwright reported a missing `/favicon.ico` 404 during dev-server manual verification; it is unrelated to the split-preview heading behavior.
  - The worktree still contains unrelated pre-existing local changes and untracked future feature notes; this session did not modify or stage them.
- Ledger decision:
  - Updated `MF-124` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-21T14:25:31+08:00`.
- Next recommended feature:
  - `MF-125` - Split view scroll positions are desynced on load.

### 2026-04-21T14:43:58+08:00 - MF-125 split view aligns scroll after layout

- Author: Codex
- Focus: strict one-feature session for `MF-125`; no second feature was implemented.
- What changed:
  - Added a regression test that opens Split view from a mid-document source scroll and waits for layout frames before checking source/preview scroll ratio alignment.
  - Deferred the split preview's initial source-to-preview scroll sync by one animation frame so it re-reads settled source and preview scroll dimensions after the preview pane has laid out.
  - Promoted `MF-125` in `harness/feature-ledger.json` only after automated, harness, lint/build, and manual verification passed.
- Changed files:
  - `packages/editor/src/editor/MarkFlowEditor.tsx`
  - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`
  - `harness/feature-ledger.json`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing percentage-based source/preview scroll sync path instead of introducing document-position mapping or new pane state.
  - Kept the fix to initial Split-view entry only; no content-sync or split-resize backlog items were touched.
- Verification:
  - `pnpm harness:start` passed and selected `MF-125`.
  - `./harness/init.sh --smoke` passed before implementation:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `469` tests passed, `3` skipped.
  - RED check passed by failing as expected before the implementation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx -t "aligns split preview scroll"` failed with preview ratio `0` vs source ratio `0.5`.
  - GREEN and regression verification passed:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx -t "aligns split preview scroll"` passed.
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx` passed (`55` tests passed, `3` skipped).
    - `pnpm --filter @markflow/editor test:run` passed (`43` test files, `470` tests passed, `3` skipped).
    - `pnpm --filter @markflow/editor lint` passed.
    - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
    - `pnpm harness:verify` passed before ledger promotion (`features: 135 total | verified=77 | ready=42 | planned=15 | blocked=1 | regression=0`; next: `MF-125`).
    - `pnpm harness:verify` passed after ledger promotion (`features: 135 total | verified=78 | ready=41 | planned=15 | blocked=1 | regression=0`; next: `MF-126`).
  - Manual verification via Vite + Playwright on Microsoft Edge:
    - Entering Split view after scrolling the starter document produced aligned source/preview ratios: `0.4914` and `0.4914`.
    - Scrolling the source pane to ratio `0.72` synced the preview pane to `0.7199`.
    - Scrolling the preview pane to ratio `0.28` synced the source pane to `0.28`.
- Remaining risks:
  - Build still reports the pre-existing Vite large-chunk warning.
  - Playwright reported the existing missing `/favicon.ico` 404 during dev-server manual verification; it is unrelated to split-view scroll sync.
  - The worktree still contains unrelated pre-existing local changes and untracked future feature notes; this session did not modify or stage unrelated feature work.
- Ledger decision:
  - Updated `MF-125` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-21T14:43:58+08:00`.
- Next recommended feature:
  - `MF-126` - Split view content sync replaces the entire preview document on every keystroke.

### 2026-04-21T15:06:37+08:00 - MF-126 split preview syncs incrementally

- Author: Codex
- Focus: strict one-feature session for `MF-126`; no second feature was implemented.
- What changed:
  - Added a regression benchmark that simulates 100 rapid source-pane edits in Split view on a 5,000+ line document with a math block.
  - Mirrored source CodeMirror transactions directly into the split preview when both panes share the same start document, preserving widget decorations instead of replacing the whole preview document.
  - Replaced the preview `content` prop fallback with a smallest-prefix/suffix diff so external content sync also avoids full-document replacement when possible.
  - Promoted `MF-126` only after automated, harness, lint/build, and manual verification passed.
- Changed files:
  - `packages/editor/src/editor/MarkFlowEditor.tsx`
  - `packages/editor/src/editor/__tests__/MarkFlowEditor.test.tsx`
  - `harness/feature-ledger.json`
  - `harness/features/MF-126.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused CodeMirror `ChangeSet` data from the source transaction instead of introducing pane-specific diff state or a new dependency.
  - Kept the fallback diff as a local helper in `MarkFlowEditor.tsx`; no broader content-sync refactor was introduced.
- Verification:
  - `pnpm harness:start` passed and selected `MF-126`.
  - `./harness/init.sh --smoke` passed before implementation:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `470` tests passed, `3` skipped.
  - RED check passed by failing as expected before implementation:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx -t "syncs split preview incrementally"` failed with a preview replacement range of `50343` characters.
  - GREEN and regression verification passed:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx -t "syncs split preview incrementally"` passed.
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx` passed (`56` tests passed, `3` skipped).
    - `pnpm --filter @markflow/editor test:run` passed (`43` test files, `471` tests passed, `3` skipped).
    - `pnpm --filter @markflow/editor lint` passed.
    - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
    - `pnpm harness:verify` passed before ledger promotion (`features: 135 total | verified=78 | ready=41 | planned=15 | blocked=1 | regression=0`; next: `MF-126`).
    - `pnpm harness:verify` passed after ledger promotion (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual verification via Vite + Playwright on Microsoft Edge:
    - In Split view with a visible KaTeX block, 60 rapid source-pane keypresses with a 5ms interval kept `.mf-math-block` mounted as the same DOM node.
    - The math node was never removed, the typed preview text appeared, and the probe recorded no console errors during the run.
- Remaining risks:
  - Build still reports the pre-existing Vite large-chunk warning.
  - The dev server still reports external Google Fonts load failure and missing `/favicon.ico` in Playwright; neither is related to split preview sync.
  - An artificial no-delay Playwright keypress loop can still trigger an existing React maximum-update-depth warning in the App shell; the realistic rapid-key probe used for verification did not reproduce it.
  - The worktree still contains unrelated pre-existing local changes and untracked future feature notes; this session did not modify or stage unrelated implementation work.
- Ledger decision:
  - Updated `MF-126` to `status=verified`, `passes=true`, `lastVerifiedAt=2026-04-21T15:05:19+08:00`.
- Next recommended feature:
  - `MF-076` - Paste as plain text shortcut strips rich formatting before insertion; it still needs the trusted desktop manual paste matrix with Microsoft Word available before promotion.

### 2026-04-21T15:14:24+08:00 - MF-076 automation remains green; Word gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the current verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of modifying already-green implementation.
  - Stopped at the missing-Word manual gate rather than promoting the ledger from partial evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T15:27:35+08:00 - MF-076 automation still passes; Word gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of changing already-green implementation.
  - Preserved the ledger truth instead of promoting `MF-076` from automated evidence alone.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T16:01:02+08:00 - MF-076 remains automation-green; Word manual gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage and editor lint/build checks instead of changing already-green implementation.
  - Preserved the ledger truth instead of promoting `MF-076` from automated evidence alone.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 135 total | verified=79 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because the manual matrix is still blocked.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T17:04:34+08:00 - MF-076 target test still passes; lint and Word gates block promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second feature was implemented.
- What changed:
  - No editor or desktop source changes were made.
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
    - `pnpm harness:verify`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null | sort`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` regression coverage instead of touching already-covered implementation.
  - Preserved the ledger truth instead of promoting `MF-076` from partial automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` failed on unrelated local zoom/content-width edits:
    - `packages/editor/src/App.tsx`: unused `WIDTH_MIN`, unused `WIDTH_MAX`, unused `updateZoomLevel`.
    - `packages/editor/src/contentWidthPreferences.ts`: empty block statement.
    - `packages/editor/src/zoomPreferences.ts`: empty block statement.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
  - Manual environment gate:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The `find` command found `/Applications/Microsoft Edge.app`, `/Applications/Safari.app`, and `/Applications/Visual Studio Code.app`, but no Word app.
- Failed or incomplete verification:
  - The required editor lint gate is currently blocked by unrelated local zoom/content-width edits.
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed on this machine.
- Remaining risks:
  - The required manual acceptance is still incomplete because `MF-076` requires paste comparisons from Microsoft Word, a webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because lint and the manual matrix are still blocked.
- Next recommended feature:
  - Continue `MF-076` after clearing the unrelated editor lint errors and in a trusted desktop session with `Microsoft Word.app` installed, then complete the Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T17:16:56+08:00 - MF-076 gains native desktop plain-text paste accelerator; promotion still blocked

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Added an Edit menu item for `Paste as Plain Text` using Electron's native `pasteAndMatchStyle` role and `CmdOrCtrl+Shift+V` accelerator.
  - Added a desktop menu regression test proving the app-level accelerator exists.
  - Left `harness/feature-ledger.json` unchanged for `MF-076` because verification is not fully green.
  - Updated `harness/features/MF-076.md` with the refreshed implementation, verification, and blocker state.
- Changed files:
  - `packages/desktop/src/main/menu.ts`
  - `packages/desktop/src/main/menu.test.ts`
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Used Electron's native `pasteAndMatchStyle` role instead of adding a new renderer clipboard API.
  - Kept the existing editor `smartPaste` path intact and only added the missing desktop accelerator path.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `67` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - TDD red: `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` failed before implementation because `Paste as Plain Text` was missing from the Edit menu.
  - TDD green: `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed after implementation (`17` tests).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`7` tests).
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop test:run` passed (`10` test files, `68` tests).
  - `pnpm --filter @markflow/desktop lint` passed.
  - `pnpm --filter @markflow/desktop build` passed.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - `pnpm --filter @markflow/editor lint` failed on unrelated local zoom/content-width edits:
    - `packages/editor/src/App.tsx`: unused `WIDTH_MIN`, unused `WIDTH_MAX`, unused `updateZoomLevel`.
    - `packages/editor/src/contentWidthPreferences.ts`: empty block statement.
    - `packages/editor/src/zoomPreferences.ts`: empty block statement.
  - The required manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Edge, Safari, and Visual Studio Code, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - The required editor lint gate remains blocked by unrelated local zoom/content-width worktree edits.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because lint and manual acceptance remain incomplete.
- Next recommended feature:
  - Continue `MF-076` after clearing the unrelated editor lint errors and in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T17:24:38+08:00 - MF-076 automation green; Word manual matrix still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Applied a minimal lint-only correction to pre-existing local zoom/content-width worktree edits so they no longer block `MF-076` automation:
    - Removed unused `WIDTH_MIN` / `WIDTH_MAX` imports and the unused `updateZoomLevel` helper in `packages/editor/src/App.tsx`.
    - Added explicit storage-failure comments to the empty `catch` blocks in `packages/editor/src/contentWidthPreferences.ts` and `packages/editor/src/zoomPreferences.ts`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `packages/editor/src/App.tsx`
  - `packages/editor/src/contentWidthPreferences.ts`
  - `packages/editor/src/zoomPreferences.ts`
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Kept the `MF-076` implementation untouched because its regression coverage already passed.
  - Used lint-only edits instead of expanding the unrelated zoom/content-width feature work.
  - Preserved ledger truth instead of promoting from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` initially failed on unrelated local zoom/content-width edits, then passed after the minimal lint-only correction.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Edge, Safari, and Visual Studio Code, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:58:59+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:25:33+08:00 - MF-076 automation still green; Word manual gate remains unavailable

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu regression coverage instead of changing already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:08:26+08:00 - MF-076 automation rerun passed; Word manual gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - No editor or desktop source changes were made because the existing `MF-076` implementation and regression coverage remain in place.
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused the existing `smartPaste` and desktop menu regression coverage instead of changing already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T17:31:34+08:00 - MF-076 automation remains green; Word manual matrix still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Re-ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Kept the existing `MF-076` implementation untouched because the feature automation already passes.
  - Preserved ledger truth instead of promoting from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` test file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T20:55:56+08:00 - MF-076 automation green; smoke stabilized and Word gate still blocks promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Investigated the startup smoke failure:
    - Two `./harness/init.sh --smoke` runs failed only on `MarkFlowEditor > syncs split preview incrementally within the 100-keystroke budget`.
    - The same test passed when filtered directly (`1542ms`) and the whole `MarkFlowEditor.test.tsx` file passed (`56` tests passed, `3` skipped; budget test `1851ms`), pointing to full-suite file parallelism distorting a wall-clock budget assertion.
  - Applied a minimal test-runner precondition fix in `packages/editor/vitest.config.ts` by disabling editor file-level parallelism.
  - Re-ran `./harness/init.sh --smoke`; it passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
  - Re-ran `pnpm harness:verify`.
- Changed files:
  - `packages/editor/vitest.config.ts`
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Kept `MF-076` product behavior untouched because its regression coverage already passes.
  - Fixed the smoke blocker at the test-runner concurrency boundary instead of weakening the split-preview incremental patch assertions.
  - Preserved ledger truth instead of promoting from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - Initial `./harness/init.sh --smoke` failed on the split-preview wall-clock budget (`4133.548666ms >= 2500ms`).
  - Re-run `./harness/init.sh --smoke` before the config fix failed on the same budget (`3993.3337500000007ms >= 2500ms`).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx -t 'syncs split preview incrementally within the 100-keystroke budget'` passed (`1` test, `58` skipped).
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/MarkFlowEditor.test.tsx` passed (`56` tests passed, `3` skipped).
  - Final `./harness/init.sh --smoke` passed after disabling editor file-level parallelism.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:15:10+08:00 - MF-076 automation still green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:31:36+08:00 - MF-076 automation still green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:40:32+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T21:48:33+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:05:26+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:14:47+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:21:11+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:33:27+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:44:28+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T22:53:33+08:00 - MF-076 automation remains green; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T23:01:36+08:00 - MF-076 automation refreshed; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T23:10:44+08:00 - MF-076 automation refreshed; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.

### 2026-04-21T23:20:36+08:00 - MF-076 automation refreshed; Word manual gate still blocks ledger promotion

- Author: Codex
- Focus: strict one-feature session for `MF-076`; no second unrelated feature was implemented.
- What changed:
  - Ran the required session startup protocol:
    - `pnpm harness:start`
    - `./harness/init.sh --smoke`
  - Made no editor or desktop source changes because the existing `MF-076` implementation and regressions remain green.
  - Re-ran the required `MF-076` automated verification:
    - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts`
    - `pnpm --filter @markflow/editor lint`
    - `pnpm --filter @markflow/editor build`
  - Re-ran the desktop menu regression covering the native plain-text paste accelerator:
    - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts`
  - Re-ran `pnpm harness:verify`.
  - Re-checked the manual verification environment:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"`
    - `osascript -e 'id of app "Microsoft Word"'`
    - `find /Applications /System/Applications /Users/pprp/Applications -maxdepth 4 \( -name 'Microsoft Word.app' -o -name 'Word.app' -o -name 'Microsoft Edge.app' -o -name 'Safari.app' -o -name 'Visual Studio Code.app' \) 2>/dev/null`
  - Updated `harness/features/MF-076.md` with the refreshed verification and blocker state.
- Changed files:
  - `harness/features/MF-076.md`
  - `harness/progress.md`
- Simplifications made:
  - Reused existing `smartPaste` and desktop menu coverage instead of modifying already-covered paste behavior.
  - Preserved ledger truth instead of promoting `MF-076` from automation-only evidence.
- Verification:
  - `pnpm harness:start` passed and selected `MF-076`.
  - `./harness/init.sh --smoke` passed:
    - `packages/desktop`: `10` test files, `68` tests passed.
    - `packages/editor`: `43` test files, `471` tests passed, `3` skipped.
  - `pnpm --filter @markflow/editor exec vitest run src/editor/__tests__/smartPaste.test.ts` passed (`1` file, `7` tests).
  - `pnpm --filter @markflow/desktop exec vitest run src/main/menu.test.ts` passed (`1` file, `17` tests).
  - `pnpm --filter @markflow/editor lint` passed.
  - `pnpm --filter @markflow/editor build` passed, with the existing Vite large-chunk warning.
  - `pnpm harness:verify` passed (`features: 136 total | verified=80 | ready=40 | planned=15 | blocked=1 | regression=0`; next: `MF-076`).
- Failed or incomplete verification:
  - The required full manual paste matrix could not be completed because `Microsoft Word.app` is not installed:
    - `mdfind "kMDItemCFBundleIdentifier == 'com.microsoft.Word'"` returned no results.
    - `osascript -e 'id of app "Microsoft Word"'` failed with `Can't get application "Microsoft Word". (-1728)`.
    - The app search found Visual Studio Code, Safari, and Microsoft Edge, but no Word app.
- Remaining risks:
  - The full manual acceptance matrix is still incomplete: Word, webpage, and Visual Studio Code with and without `Cmd/Ctrl+Shift+V`.
  - `harness/feature-ledger.json` still has unrelated pre-existing local changes adding future features; this session did not modify or stage that ledger change.
- Ledger decision:
  - Left `harness/feature-ledger.json` unchanged for `MF-076` (`status=ready`, `passes=false`, `lastVerifiedAt=null`) because manual acceptance remains incomplete.
- Next recommended feature:
  - Continue `MF-076` in a trusted desktop session with `Microsoft Word.app` installed, then run the full Word/webpage/VS Code with-and-without-shortcut paste matrix before promoting the ledger.
