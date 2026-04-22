#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "→ Detected platform: $OS / $ARCH"

echo "→ Cleaning previous build artifacts…"
node ./scripts/build/cleanBuildArtifacts.mjs

echo "→ Building editor bundle…"
pnpm --filter @markflow/editor build

echo "→ Building desktop main process…"
pnpm --filter @markflow/desktop build

cd packages/desktop

case "$OS" in
  Darwin)
    echo "→ Packaging macOS DMG + ZIP (x64 + arm64)…"
    npx electron-builder --config electron-builder.yml --mac dmg zip
    echo ""
    echo "⚠  Unsigned build — users on macOS 13+ will see 'file is damaged'."
    echo "   Fix for end-users (run once after downloading):"
    echo "     xattr -cr /Applications/MarkFlow.app"
    echo "   To sign properly: set CSC_LINK, CSC_KEY_PASSWORD, and update"
    echo "   electron-builder.yml identity + notarize fields."
    ;;
  Linux)
    echo "→ Packaging Linux AppImage + deb (x64)…"
    npx electron-builder --config electron-builder.yml --linux AppImage deb
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    echo "→ Packaging Windows NSIS installer (x64)…"
    npx electron-builder --config electron-builder.yml --win nsis
    ;;
  *)
    echo "✗ Unknown OS: $OS. Pass --mac / --linux / --win manually."
    echo "  Example: cd packages/desktop && npx electron-builder --config electron-builder.yml --mac"
    exit 1
    ;;
esac

echo "✓ Build artifacts ready in dist-desktop/"
