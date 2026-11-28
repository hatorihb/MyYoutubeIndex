#!/bin/bash
# SessionStart hook: install deps so lint/typecheck/test work in remote sessions.
set -euo pipefail

# Only install in remote (Claude Code on the web). Locally you likely already have deps.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || { echo "hook: cannot cd to $CLAUDE_PROJECT_DIR" >&2; exit 2; }

if [ -f "pnpm-lock.yaml" ]; then
  command -v pnpm >/dev/null || npm install -g pnpm
  pnpm install --prefer-offline
elif [ -f "yarn.lock" ]; then
  command -v yarn >/dev/null || npm install -g yarn
  yarn install --prefer-offline
elif [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
  command -v bun >/dev/null || npm install -g bun
  bun install
else
  npm install --prefer-offline
fi
