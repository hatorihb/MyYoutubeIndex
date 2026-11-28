#!/bin/bash
# Run the harness's file-content hooks over the files a pull request changes —
# the same checks Claude's PostToolUse hooks apply during a session, so edits
# made outside one (by hand, by another tool) are held to them too.
#
# Only hooks that inspect file content and need no project tooling run here:
# secret-scan, content-check, and report-check (content-check's name in early
# content repos). Formatting and type-regeneration hooks are left out.
set -uo pipefail
BASE="${1:?usage: hooks.sh <base-sha>}"
export CLAUDE_PROJECT_DIR="$PWD"

hooks=()
for h in secret-scan content-check report-check; do
  [ -f ".claude/hooks/$h.sh" ] && hooks+=(".claude/hooks/$h.sh")
done
if [ "${#hooks[@]}" -eq 0 ]; then
  echo "No harness file hooks in this repo — nothing to run."
  exit 0
fi

blocked=0
checked=0
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  checked=$((checked + 1))
  for h in "${hooks[@]}"; do
    out=$(jq -cn --arg p "$PWD/$f" '{tool_input: {file_path: $p}}' | bash "$h" 2>&1)
    rc=$?
    if [ "$rc" -eq 2 ]; then
      echo "::error file=$f::$(basename "$h" .sh) blocked this file"
      printf '%s\n\n' "$out"
      blocked=$((blocked + 1))
    elif [ "$rc" -ne 0 ]; then
      echo "::warning file=$f::$(basename "$h" .sh) exited $rc (not a block)"
    fi
  done
done < <(git diff -z --name-only --diff-filter=ACMR "$BASE"...HEAD)

echo "Checked $checked changed file(s) with: ${hooks[*]}"
[ "$blocked" -eq 0 ]
