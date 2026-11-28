# Project guidelines

Vite + React single-page app in **JavaScript** (`.jsx`, no TypeScript), backed by Supabase, deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to `main`.

## Quality bar (enforced by hooks and Harness CI)
- The harness Stop hook and Harness CI run the `typecheck` / `lint` / `test` scripts in `package.json` when they exist. None exist yet, so today CI verifies that dependencies install; `build-check.yml` verifies `npm run build` on every PR. Adding a `lint` or `test` script makes both gates meaningful.
- Run `npm run build` before declaring a change done.

## Supabase
- `src/lib/supabase.js` holds the project URL and **publishable** key. Those are client-safe by design: what protects the data is the row level security policies in `supabase/migrations/`. Every new table needs RLS enabled and explicit policies.
- Migrations are append-only: add a new file in `supabase/migrations/`, never edit an applied one. `verify-migrations.yml` checks them on PRs that touch `supabase/`.
- Never put the service-role key in client code.

## Conventions
- Errors propagate. Don't swallow them with empty `catch` blocks.
- Don't introduce new dependencies without a clear reason.
- Don't add comments explaining WHAT the code does. Only WHY when non-obvious.

## Before committing
1. Run `/review` for a self-review pass.
2. Run `/security-review` if the change touches auth, Supabase policies, or external calls.


## Security guardrails

The `secret-scan` PostToolUse hook blocks edits that look like leaked secrets or client-bundle leaks. If a match is intentional (test fixture etc.), add the literal `SECRET-SCAN-OK` comment on the same line, or move it to a gitignored path.

### What gets blocked
- **Live keys committed to non-gitignored files**: Stripe (`sk_live_*`), GitHub PATs (`ghp_*`, `github_pat_*`), Slack (`xox*-*`), OpenAI (`sk-...{48}` / `sk-proj-*`), Anthropic (`sk-ant-api03-*`), AWS (`AKIA*`), Google (`AIza*`), private key PEM blocks, JWTs.
- **`NEXT_PUBLIC_*(SECRET|PASSWORD|PRIVATE|API_KEY)*`** in any file. These ship to the browser. Even in `.env.local`, define them server-only and proxy if you need browser access.

### Rules for the model
- Never paste a real secret as a default value in code. Use `process.env.X` with no fallback, and let validation fail loudly if it's missing.
- For test fixtures, use clearly fake values: `sk_test_FAKE_FAKE_FAKE`. Real test keys still pattern-match.
- `.env.example` is committed — it must contain only placeholder values.
- Don't add an env var to `.env*` until you've decided whether it's server-only or `NEXT_PUBLIC_*`. Default to server-only.

### What the hook does NOT catch
- Custom/proprietary token formats. Add patterns to `secret-scan.sh` as you encounter them.
- Secrets in commit history. Run `mcp__github__run_secret_scanning` after enabling GitHub Advanced Security on the repo.
- Vulnerable dependencies. Run `npm audit --audit-level=high` as part of `/predeploy`.


## CI (Harness CI)

`.github/workflows/harness-ci.yml` runs on every PR and push to main. For each Node and Python project in the repo it installs dependencies and runs the same gate as the Stop hook (typecheck / lint / test where defined; Python: syntax always, ruff / mypy when configured, pytest when tests exist). It also runs secret-scan / content-check over the PR's changed files and actionlint over the workflows.

- CI only verifies what the project defines. A project with no test script or tests is only install-checked — and Dependabot auto-merge trusts these checks. Add tests with every feature.
- When CI fails, read the job log, fix the cause, and push. Don't weaken the check (deleting a test, adding a lint ignore) to get green.
- The logic is in `.github/harness-ci/*.sh`; it is generated — re-run `./install.sh add . --with ci` to update rather than editing it.


## Planning with /grill-me

Before implementing anything with vague requirements, run `/grill-me` (a 3-line skill by [Matt Pocock](https://github.com/mattpocock)). It interrogates the plan one question at a time — depth-first down the design tree, each question paired with a recommended answer — until intent is fully pinned down. The Q&A history then serves as the spec: follow it when implementing.

Skip it for trivial diffs, bug fixes, or work where the requirements are already precise.


## Dependency updates (Dependabot)

Dependabot opens a PR immediately whenever a dependency has a published vulnerability, and once a week opens one grouped PR of minor/patch updates per package directory (each release held 5 days first). Patch and minor PRs merge automatically once every other check on the PR passes; major updates, and any PR whose checks fail, stay open for manual handling.

- When asked to handle an open Dependabot PR, read the changelog for breaking changes, adapt the code, and get the checks green. Security PRs are priority work — each open one is a known vulnerability in production.
- `.github/dependabot.yml` is generated: after adding a package directory, re-run `./install.sh add . --with dependabot` instead of editing it.
- Never add `ignore:` rules to it: Dependabot applies `ignore` to security updates too, so it would silently block vulnerability fixes. To stop a version update, close its PR or use `allow`.
- Auto-merge is only as safe as the checks behind it. When adding features, add tests — they are what stops a bad update from shipping unattended.
