# Reproducible mise local development

## Issue

- Issue: #94
- Branch: `codex/issue-94`
- Base commit: `e8a61197a2198d5ec92c38db709ba54794ebb90f`

## Outcome

A new clone can use the repository-owned mise configuration and tasks to prepare
the local environment, start Levi, prove liveness and readiness, and stop the
development service without assembling commands by hand.

## Context

- `.node-version` and `package.json` already pin Node.js 24.19.0 and pnpm
  11.19.0.
- `compose.yaml` provides separate persistent development and disposable test
  PostgreSQL services.
- `scripts/check-readiness.ts` verifies application and database readiness, but
  the repository does not yet expose a complete local smoke workflow.

## Constraints

- Preserve existing `.env` values and database data.
- Start and stop only the development PostgreSQL service from local mise tasks.
- Do not install mise or Docker automatically and do not touch production.
- Keep all runtime and package-manager pins mutually consistent.

## Non-goals

- Application behavior changes.
- Production deployment or production database operations.
- Installing host-level prerequisites.

## Plan

1. [x] Add the mise Node.js pin and repository-owned setup, development, smoke,
       and stop tasks.
2. [x] Add idempotent local environment preparation and development-only
       database commands.
3. [x] Add automated drift/idempotency checks and concise README instructions.
4. [x] Run setup twice, start the application, verify health/readiness, and run
       all canonical checks.
5. [ ] Perform a separate diff review, open a PR, and merge only after all four
       required exact-head checks pass.

## Progress

- 2026-08-21 22:00 JST — Created Issue #94, inspected the existing runtime,
  database, environment, readiness, and governance workflows, and acquired the
  writer lease in an isolated worktree.
- 2026-08-21 22:15 JST — `mise install`, task validation, and two consecutive
  `mise run setup` executions passed. The second setup preserved `.env`, reused
  the healthy development database, found no pending migrations, regenerated
  Prisma Client, and completed the deterministic seed.
- 2026-08-21 22:15 JST — Started Next.js 16.3.1 with the development task; the
  smoke task passed liveness, readiness, and database health, and `/` returned
  HTTP 200.
- 2026-08-21 22:20 JST — Corrected local test-environment isolation discovered
  during verification. Final verification passed 142 unit tests, 23 component
  tests, 72 integration tests, 9 latest-Chromium tests, the production build,
  and the security check.
- 2026-08-21 22:25 JST — Reviewed the complete staged diff for scope, secrets,
  environment preservation, database isolation, unsafe defaults, and generated
  noise; no unresolved findings remain.
- 2026-08-21 22:27 JST — PR #95 passed Quality, E2E, and Security. Database
  exposed that the full rollback/backup/restore rehearsal took 6.36 seconds on
  CI and exceeded Vitest's generic 5-second limit. Kept retries at zero and all
  assertions intact; assigned the long-running rehearsal an explicit 30-second
  upper bound before repeating local and exact-head verification.

## Decisions

- 2026-08-21 — Decision: keep `.node-version` as a compatibility pin and add
  `mise.toml` as the primary local runtime entry point.
  - Reason: existing CI and other version managers retain compatibility while
    mise users get a repository-owned tool and task definition.
- 2026-08-21 — Decision: append only missing public example keys to `.env`.
  - Reason: a stale local file becomes usable without replacing any operator
    value; repeated setup remains idempotent.
- 2026-08-21 — Decision: use a stable `levi` local Compose project name.
  - Reason: issue worktrees otherwise create competing PostgreSQL containers on
    the same fixed loopback port; sharing the named development service avoids
    a false-positive setup against a different worktree's database.
- 2026-08-21 — Decision: make the local canonical-check task override only the
  database URLs and auth origin needed by that task.
  - Reason: `next build` correctly enables production validation and rejects the
    HTTP origin needed by `next dev`; unit tests require a database URL, while
    integration/E2E runners must remain free to select their isolated test DB.
    CI already follows the same explicit-environment pattern.
- 2026-08-21 — Decision: give the local E2E runner an explicit port-3100 auth
  origin while retaining environment-variable overrides.
  - Reason: `.env` intentionally configures the port-3000 development server;
    allowing it to configure Playwright's port-3100 server causes CSRF origin
    rejection and prevents a reproducible local E2E run.
- 2026-08-21 — Decision: use a test-local 30-second limit for the database
  rehearsal instead of retrying CI.
  - Reason: the operation intentionally performs failure injection, retry,
    backup, restore, and reconciliation; CI evidence measured 6.36 seconds, so
    the generic 5-second unit-scale default was not a valid integration bound.

## Risks and mitigations

- Risk: setup could unexpectedly start the disposable test database.
  - Mitigation: introduce a command targeting only the `postgres` Compose
    service and assert that target in the configuration check.
- Risk: runtime pins can drift across configuration files.
  - Mitigation: make pin consistency part of `pnpm check`.

## Verification

- [x] `mise install`
- [x] `mise run setup` twice
- [x] `mise run dev` plus `mise run smoke`
- [x] `mise run check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] Exact-head `Quality`, `Database`, `E2E`, and `Security`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, repeated setup, local runtime smoke, canonical
  checks, integration, E2E, and security verification.
- Remaining: final review, commit, PR, exact-head CI, and merge.
- Blocker: none.
- Resume with: review and commit the complete Issue #94 diff.

## Result

Pending.
