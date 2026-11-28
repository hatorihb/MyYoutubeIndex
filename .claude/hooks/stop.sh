#!/bin/bash
# Stop hook: full quality gate before Claude ends its turn.
# Blocks (exit 2) if typecheck/lint/test fail so Claude must fix before stopping.
set -uo pipefail

input=$(cat)
stop_active=$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")

# Prevent infinite loop if Claude already ran a fix attempt triggered by this hook
if [ "$stop_active" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || { echo "hook: cannot cd to $CLAUDE_PROJECT_DIR" >&2; exit 2; }

# Skip if no JS/TS files changed since last commit (fast path)
if git diff --quiet HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null && \
   git diff --cached --quiet HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null; then
  exit 0
fi

RUN="npm run"
[ -f "pnpm-lock.yaml" ] && RUN="pnpm"
[ -f "yarn.lock" ] && RUN="yarn"
{ [ -f "bun.lockb" ] || [ -f "bun.lock" ]; } && RUN="bun run"

has_script() {
  node -e "try{const s=require('./package.json').scripts||{};process.exit(s['$1']?0:1)}catch{process.exit(1)}" 2>/dev/null
}

errors=""

if has_script typecheck; then
  if ! out=$($RUN typecheck 2>&1); then
    errors="${errors}❌ typecheck failed:
${out}

"
  fi
fi

if has_script lint; then
  if ! out=$($RUN lint 2>&1); then
    errors="${errors}❌ lint failed:
${out}

"
  fi
fi

if has_script test; then
  if ! out=$($RUN test 2>&1); then
    errors="${errors}❌ tests failed:
${out}

"
  fi
fi

if [ -n "$errors" ]; then
  printf '%s\n' "$errors" >&2
  printf '\nFix these before ending the turn. Do not commit broken code.\n' >&2
  exit 2
fi

exit 0
