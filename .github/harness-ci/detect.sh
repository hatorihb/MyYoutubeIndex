#!/bin/bash
# Print the project directories Harness CI checks, as GitHub Actions outputs:
#   node=["frontend"]          dirs with a package.json
#   python=["backend"]         dirs with requirements*.txt / pyproject.toml / Pipfile / setup.py
# A directory inside another detected project of the same kind is skipped:
# the outer one (e.g. a workspace root) already covers it.
set -euo pipefail
cd "${1:-.}"

dirs_with() {
  find . \( -name node_modules -o -name .git -o -name .venv -o -name venv -o -name vendor -o -name dist -o -name build \) -prune \
    -o -type f \( "$@" \) -print0 \
    | xargs -0 -r -n1 dirname \
    | sed 's|^\./||' \
    | sort -u
}

# Drop directories nested inside an earlier one (sorted input: parents come first).
outermost() {
  local kept=() d k nested
  while IFS= read -r d; do
    nested=false
    for k in ${kept[@]+"${kept[@]}"}; do
      if [ "$k" = "." ] || [[ "$d" == "$k"/* ]]; then nested=true; break; fi
    done
    [ "$nested" = false ] && kept+=("$d")
  done
  [ ${#kept[@]} -gt 0 ] && printf '%s\n' "${kept[@]}"
  return 0
}

as_json() { jq -R . | jq -sc .; }

echo "node=$(dirs_with -name package.json | outermost | as_json)"
echo "python=$(dirs_with -name 'requirements*.txt' -o -name pyproject.toml -o -name Pipfile -o -name setup.py | outermost | as_json)"
