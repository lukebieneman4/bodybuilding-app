#!/usr/bin/env bash
# Verification entry point for the web app. Sets node on PATH (it lives in
# ~/.local/node and the non-interactive tool shell does not source the profile),
# then runs the test suite, type-check, and production build. Fails fast.
#
# Allowlisted as `bash web/*` so it runs without per-command prompts under Hotfire.
set -e
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")"

case "${1:-all}" in
  test)  npm test ;;
  check) npm run check ;;
  build) npm run build ;;
  dev)   npm run dev ;;
  *)
    echo "== test ==";  npm test
    echo "== check =="; npm run check
    echo "== build =="; npm run build
    ;;
esac
