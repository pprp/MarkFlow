#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo "→ Cleaning previous build artifacts…"
node ./scripts/build/cleanBuildArtifacts.mjs

echo "→ Building editor bundle…"
pnpm --filter @markflow/editor build

echo "→ Building desktop main process…"
pnpm --filter @markflow/desktop build

echo "→ Packaging DMG (x64 + arm64)…"
cd packages/desktop
npx electron-builder --config electron-builder.yml --mac dmg

echo "✓ DMG ready in dist-desktop/"
