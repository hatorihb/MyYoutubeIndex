#!/bin/bash
# Install a Node project's dependencies from its lockfile, then run the same
# gate as the harness Stop hook: whichever of the typecheck, lint and test
# scripts the project defines. npm's placeholder test script is skipped.
set -uo pipefail
cd "${1:-.}" || exit 1

if [ -f pnpm-lock.yaml ]; then PM=pnpm
elif [ -f yarn.lock ]; then PM=yarn
elif [ -f bun.lock ] || [ -f bun.lockb ]; then PM=bun
else PM=npm
fi

echo "::group::install ($PM)"
case "$PM" in
  pnpm|yarn) { command -v corepack >/dev/null || npm install -g corepack; } && corepack enable ;;
  bun) npm install -g bun ;;
esac
case "$PM" in
  pnpm) pnpm install --frozen-lockfile ;;
  yarn) yarn install --immutable || yarn install --frozen-lockfile ;;
  bun) bun install --frozen-lockfile ;;
  npm) if [ -f package-lock.json ]; then npm ci; else npm install; fi ;;
esac
install_rc=$?
echo "::endgroup::"
if [ "$install_rc" -ne 0 ]; then
  echo "::error::Dependency install failed ($PM). If this is a Dependabot PR, the update conflicts with other dependencies."
  exit 1
fi

script_of() {
  node -e 'const s = require("./package.json").scripts || {}; process.stdout.write(s[process.argv[1]] || "")' "$1"
}

ran=0
failed=()
for s in typecheck lint test; do
  cmd=$(script_of "$s")
  [ -z "$cmd" ] && continue
  case "$cmd" in *"no test specified"*) continue ;; esac
  echo "::group::$s"
  "$PM" run "$s" || failed+=("$s")
  echo "::endgroup::"
  ran=$((ran + 1))
done

if [ "${#failed[@]}" -gt 0 ]; then
  echo "::error::Failed: ${failed[*]}"
  exit 1
fi
if [ "$ran" -eq 0 ]; then
  echo "::warning::No typecheck, lint or test script in package.json — CI only verified that dependencies install. Add scripts to make this check meaningful."
fi
exit 0
