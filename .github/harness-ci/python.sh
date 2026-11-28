#!/bin/bash
# Install a Python project's dependencies, then run the checks it is set up for:
#   - a syntax check of every .py file (always)
#   - ruff / mypy only when the project configures them
#   - pytest when tests exist
# Tools the project hasn't adopted are not run, so an existing codebase isn't
# failed on day one for rules it never agreed to.
set -uo pipefail
cd "${1:-.}" || exit 1

PIP=(python -m pip install -q)
pip_install() { "${PIP[@]}" "$@"; }

# Dependencies declared in pyproject.toml ([project] deps plus dev/test extras
# and dependency-groups), one per line. Empty when tomllib is unavailable.
pyproject_deps() {
  python - <<'PY' 2>/dev/null
import tomllib
d = tomllib.load(open("pyproject.toml", "rb"))
p = d.get("project", {})
deps = list(p.get("dependencies", []))
for k in ("dev", "test", "tests"):
    deps += p.get("optional-dependencies", {}).get(k, [])
    deps += [x for x in d.get("dependency-groups", {}).get(k, []) if isinstance(x, str)]
print("\n".join(deps))
PY
}

echo "::group::install"
install_rc=0
if [ -f uv.lock ]; then
  pip_install uv && uv sync --frozen --all-extras || install_rc=$?
  export VIRTUAL_ENV="$PWD/.venv" PATH="$PWD/.venv/bin:$PATH"
  PIP=(uv pip install -q)  # uv venvs have no pip
elif [ -f poetry.lock ]; then
  pip_install poetry && poetry config virtualenvs.create false && poetry install --no-interaction || install_rc=$?
elif [ -f Pipfile ]; then
  pip_install pipenv && pipenv install --system --dev || install_rc=$?
else
  found=false
  for f in requirements.txt requirements-dev.txt requirements_dev.txt dev-requirements.txt; do
    if [ -f "$f" ]; then pip_install -r "$f" || install_rc=$?; found=true; fi
  done
  if [ "$found" = false ] && [ -f pyproject.toml ]; then
    deps=$(pyproject_deps)
    if [ -n "$deps" ]; then
      printf '%s\n' "$deps" > "${RUNNER_TEMP:-/tmp}/harness-ci-reqs.txt"
      pip_install -r "${RUNNER_TEMP:-/tmp}/harness-ci-reqs.txt" || install_rc=$?
    fi
  elif [ "$found" = false ] && [ -f setup.py ]; then
    pip_install -e . || install_rc=$?
  fi
fi
echo "::endgroup::"
if [ "$install_rc" -ne 0 ]; then
  echo "::error::Dependency install failed. If this is a Dependabot PR, the update conflicts with other dependencies."
  exit 1
fi

configured() {
  { [ -f pyproject.toml ] && grep -q "^\[tool\.$1" pyproject.toml; } && return 0
  case "$1" in
    ruff) [ -f ruff.toml ] || [ -f .ruff.toml ] ;;
    mypy) [ -f mypy.ini ] || [ -f .mypy.ini ] || { [ -f setup.cfg ] && grep -q '^\[mypy' setup.cfg; } ;;
    *) return 1 ;;
  esac
}

has_tests() {
  [ -d tests ] || [ -n "$(find . \( -name .venv -o -name venv -o -name node_modules \) -prune -o -type f \( -name 'test_*.py' -o -name '*_test.py' \) -print -quit)" ]
}

failed=()
check() {
  local name="$1"; shift
  echo "::group::$name"
  "$@" || failed+=("$name")
  echo "::endgroup::"
}
pytest_run() {
  python -m pytest -q
  local rc=$?
  [ "$rc" -eq 5 ] && return 0  # no tests collected
  return "$rc"
}

check "syntax" python -m compileall -q -x '(^|/)(\.venv|venv|node_modules|build|dist)/' .

if configured ruff; then
  pip_install ruff && check ruff python -m ruff check .
else
  echo "::notice::ruff not configured in $(pwd) — skipped (add [tool.ruff] to pyproject.toml to enable)"
fi
if configured mypy; then
  pip_install mypy && check mypy python -m mypy .
else
  echo "::notice::mypy not configured in $(pwd) — skipped (add [tool.mypy] to pyproject.toml to enable)"
fi
if has_tests; then
  { python -m pytest --version >/dev/null 2>&1 || pip_install pytest; } && check pytest pytest_run
else
  echo "::warning::No tests in $(pwd) — CI only verified that dependencies install and the code parses."
fi

if [ "${#failed[@]}" -gt 0 ]; then
  echo "::error::Failed: ${failed[*]}"
  exit 1
fi
exit 0
