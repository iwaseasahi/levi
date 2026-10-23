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
7. [ ] Request approval for publishing the exact verified commit as production
       images and deploying it through the standard release workflow.

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
- 2026-10-23 JST — PR #533 passed all four required checks at
  `bbaad22a7fba35612c173fc198fa758807ee6fc7` and merged as `6a58964`, closing
  prerequisite #531. Integrated that dependency update and current main.
- 2026-10-23 JST — The combined Node.js 24.22.1/package graph passed frozen
  installation, `mise run check`, 141 integration tests, all 35 E2E scenarios,
  and the unchanged audit/license gate. Both production Dockerfiles built on
  native ARM64 and production-target Linux/AMD64; both AMD64 images report
  `v24.22.1`. The existing three moderate findings are tracked in #534.
- 2026-10-23 JST — Initial PR #532 CI passed Quality/Database but reproduced
  known sidebar E2E failure #517 and the dependency Security failure. No retries,
  timeouts, or security controls were changed; final CI must validate the
  integrated package update on the new head.
- 2026-10-23 JST — Production metadata names base commit `05c5551`; comparison
  confirms no application source or migration changes. GHCR publication and
  production deployment remain approval-bound external actions; all local
  preparation is complete before requesting that approval.

## Verification

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
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
- Blocker: none for repository work; prerequisite #531 is merged and the
  security gate passes locally. Required exact-head CI remains the merge gate.
- Attempts: initial integration rehearsal failed because the local development
  PostgreSQL service was stopped. Started it with `pnpm db:up:dev`; all 141
  integration tests then passed without test changes. Initial nested commands
  resolved the desktop fallback pnpm; enabling Corepack in the new mise-managed
  Node.js installation resolved the environment, without repository changes.
- Decision needed: approval to publish the verified commit as immutable images
  and deploy to production, after the final required CI and merge.
- Resume with: inspect final PR #532 checks and merge when green; present the
  exact merged commit and production impact for approval.
