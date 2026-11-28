#!/bin/bash
# PostToolUse hook: fast per-file checks after every Edit/Write.
# Exit code 2 sends stderr back to Claude so it can self-correct.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

[ -z "$file_path" ] && exit 0
[ ! -f "$file_path" ] && exit 0

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || { echo "hook: cannot cd to $CLAUDE_PROJECT_DIR" >&2; exit 2; }

# Detect package manager
PM="npm"
[ -f "pnpm-lock.yaml" ] && PM="pnpm"
[ -f "yarn.lock" ] && PM="yarn"
[ -f "bun.lockb" ] || [ -f "bun.lock" ] && PM="bun"

EXEC="$PM exec"
[ "$PM" = "npm" ] && EXEC="npx --no-install"
[ "$PM" = "bun" ] && EXEC="bunx"

errors=""

# Prettier (auto-format) — silent on success
if $EXEC prettier --version >/dev/null 2>&1; then
  $EXEC prettier --write --log-level=warn "$file_path" >/dev/null 2>&1 || true
fi

# ESLint (auto-fix then report) — only flag what couldn't be auto-fixed
if $EXEC eslint --version >/dev/null 2>&1; then
  if ! lint_out=$($EXEC eslint --fix "$file_path" 2>&1); then
    errors="${errors}ESLint issues in ${file_path}:
${lint_out}

"
  fi
fi

if [ -n "$errors" ]; then
  printf '%s' "$errors" >&2
  exit 2
fi

exit 0
