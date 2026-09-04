# Speed up pnpm setup in CI

## Issue

- Issue: #476
- Branch: `codex/issue-476`
- Base commit: `4874ddddac2c9d0496a7b83fc33790fd58f41f55`

## Outcome

All four required CI jobs use pnpm's supported setup action for pnpm 11 and
avoid the legacy action's npm-based self-installer.

## Context

- `.github/workflows/ci.yml` currently runs `pnpm/action-setup` and
  `actions/setup-node` separately in every required job.
- Run 33847051505 spent 7m03s in the Quality setup step and 6m07s in the
  Security setup step, while the frozen project install took 6–7 seconds.
- `package.json` pins pnpm 11.19.0 and `mise.toml` pins Node.js 24.19.0.
- The pnpm project directs pnpm 11 users from `pnpm/action-setup` to
  `pnpm/setup`.

## Constraints

- Keep the required job names and all existing verification commands.
- Keep the pnpm and Node.js versions pinned and installs frozen.
- Pin the GitHub Action to an immutable commit SHA.
- Keep one pnpm store cache implementation rather than layering caches.

## Non-goals

- Combining required jobs or changing their timeouts.
- Changing application dependencies, test behavior, or security policy.

## Plan

1. [x] Replace the two runtime setup actions in all required jobs with pinned
       `pnpm/setup`, preserving the explicit frozen install.
2. [x] Update CI documentation and the repository configuration guard.
3. [x] Run focused and canonical verification, then open a pull request and
       compare required CI timings with the baseline.

## Progress

- 2026-09-04 16:18 JST — Started from `origin/main`; inspected Issue #476,
  `.github/workflows/ci.yml`, `docs/ci.md`, and the official action sources.
- 2026-09-04 16:22 JST — Completed steps 1–2; all four jobs use the pinned
  successor action, and `pnpm local:config:check` plus workflow YAML parsing
  pass.
- 2026-09-04 16:23 JST — `mise run check` passed: formatting, lint, typecheck,
  77 unit files / 488 tests, 25 component files / 113 tests, configuration
  guards, and production build. `pnpm security:check` passed with no high or
  critical vulnerability and 314 approved license records.
- 2026-09-04 16:26 JST — Required CI passed on commit `bccb7d4`. The new setup
  took 7 seconds in Quality, Database, and Security and 8 seconds in E2E,
  compared with 7m03s, 36s, 6m07s, and 50s respectively in run 33847051505.

## Decisions

- 2026-09-04 — Decision: use `pnpm/setup` v2.1.0 commit
  `703c52620218391530e48b9e8870d5c0082e1b9b`.
  - Reason: it is the pnpm project's supported successor for pnpm 11+, avoids
    the legacy npm CLI bootstrap, and can set up Node.js and the pnpm store
    cache in one step.
  - Alternatives: enabling `cache` on `pnpm/action-setup` does not cache the
    pnpm CLI bootstrap and would duplicate the existing store cache.
  - ADR: not required; this is a reversible CI implementation update.
- 2026-09-04 — Decision: retain the explicit
  `pnpm install --frozen-lockfile` step with `install: false` on the action.
  - Reason: this preserves the visible repository-owned install contract and
    its existing failure semantics.

## Risks and mitigations

- Risk: a new setup action changes the effective runtime versions or install
  behavior.
  - Mitigation: source pnpm from the exact `packageManager` pin, pin Node.js in
    the action input, retain the frozen install, and enforce all settings in
    the local configuration check.
- Risk: CI remains dependent on external downloads on a cold runner.
  - Mitigation: use the successor's direct pnpm bootstrap and built-in store
    cache; verify observed timings in all four required jobs.

## Verification

- [x] `pnpm local:config:check`
- [x] `mise run check` — includes format, lint, typecheck, tests, configuration
      checks, and production build
- [x] `pnpm security:check`
- [x] Workflow YAML parses successfully
- [x] `git diff --check`
- [x] Required CI jobs pass and setup timings are compared with run 33847051505
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, local verification, PR #477, and required CI
  timing comparison.
- Remaining: none.
- Blocker: none.
- Resume with: update `.github/workflows/ci.yml`.

## Result

PR #477 replaces both legacy setup actions with the supported pnpm 11 setup
action in all required jobs. The first required CI run passed and reduced pnpm
plus Node.js setup to 7–8 seconds per job. No application, test, timeout, or
security policy behavior changed.
