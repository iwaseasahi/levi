# Run Levi on the October 2026 Node.js security release

## Issue

- Issue: #530
- Branch: `codex/issue-530`
- Base commit: `05c5551` (current `origin/main` at intake)

## Outcome

Pin development, all four protected CI jobs, and both production Dockerfiles to
Node.js 24.22.1, including verified immutable container digests. Reject older
Node.js releases through the package engine requirement.

## Context

- [October security advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Node.js 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1)
- Existing runtime: 24.19.0; fixed release published 2026-10-21.
- ADR 0003 requires exact runtime pins, frozen installs, and one major upgrade
  at a time. Node.js 24 remains the selected LTS line.
- `docker buildx imagetools inspect node:24.22.1-alpine3.23` resolved the official
  multi-platform index to
  `sha256:0468540aa58203ff9e40c2aab3907c52644ab818af6176b1c70a026137dc92a2`.
- No parent or dependency Issues. Existing E2E follow-ups: #517 and #522.

## Constraints and non-goals

- Keep pnpm 11.19.0, the dependency graph, and stable required check names.
- No feature, schema, migration, authentication, or authorization changes.
- Production deployment requires approval of the concrete release under
  `docs/governance/autonomy.md`; prepare and verify first.
- Do not edit historical execution plans just to replace old version evidence.

## Plan

1. [x] Verify upstream security fixes and current repository/runtime pins.
2. [x] Create the Issue, isolated branch/worktree, and writer lease.
3. [x] Update runtime pins, minimum engine, README, and existing drift checks.
4. [x] Verify frozen installation, canonical checks, coverage, integration/E2E,
       backup rehearsal, and security under Node.js 24.22.1.
5. [x] Verify pinned container runtime and both production image builds.
6. [ ] Review the full diff, open a PR, pass exact-head required CI, and merge.
7. [ ] Prepare a concrete production candidate and request deployment approval.

## Decisions

- 2026-10-23 — Use 24.22.1, retaining Node.js 24 LTS and Alpine 3.23. The
  dependency lockfile needs no changes because the application package graph
  is unchanged; no npm package-age exception is needed for a runtime update.
- 2026-10-23 — Raise `engines.node` to `>=24.22.1 <25` so strict engine checking
  rejects the vulnerable development runtime as well as older Node.js majors.

## Progress

- 2026-10-23 JST — Read governance, agent protocol, testing/CI policy, dependency
  policy, ADR 0003, and production deployment runbook. Confirmed upstream
  release and container index; updated all active runtime pins.

## Verification

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [ ] `pnpm security:check`
- [x] `pnpm backup:rehearse`
- [x] Pinned container `node --version` and both Dockerfile builds
- [x] `git diff --check` and separate full-diff review
- [ ] Exact-head Quality, Database, E2E, Security

## Handoff or blockers

- Completed: runtime updates; frozen install; `mise run check` (539 unit and
  126 component tests plus build); coverage; 141 integration tests; 35 E2E
  tests; backup rehearsal; both production image builds and `v24.22.1` runtime
  checks. The drift guard rejected a temporarily outdated container stage.
- Remaining: exact-head CI, merge, and concrete release preparation.
- Blocker: `pnpm security:check` detects existing dependency advisories in the
  unchanged lockfile; prerequisite Issue #531 tracks the isolated fix.
- Attempts: initial integration rehearsal failed because the local development
  PostgreSQL service was stopped. Started it with `pnpm db:up:dev`; all 141
  integration tests then passed without test changes. Initial nested commands
  resolved the desktop fallback pnpm; enabling Corepack in the new mise-managed
  Node.js installation resolved the environment, without repository changes.
- Decision needed: none for repository work; production approval remains pending.
- Resume with: merge #531, update this branch, and repeat required CI.
