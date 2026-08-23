# Force destructive tests onto the dedicated test database

## Issue

- Issue: #209
- Branch: `codex/issue-209`
- Base commit: `84549ea`

## Outcome

Integration and E2E fixtures can only run against the loopback `levi_test`
database. An ambient development `DATABASE_URL` is never selected by either
test runner.

## Context

- `scripts/run-integration-tests.ts` and `scripts/run-e2e-tests.ts` currently
  fall back to `DATABASE_URL` before the dedicated test default.
- Integration and E2E cleanup fixtures delete scripture rows, so target
  selection must fail closed before migrations or fixtures run.
- CI currently exposes the test service through the generic `DATABASE_URL`.

## Constraints

- Keep CI and local execution supported on loopback PostgreSQL.
- Do not change fixture behavior in this Issue.
- Do not access or mutate the development `levi` database during verification.

## Non-goals

- Restoring the damaged local catalog (#210).
- Removing `rightsStatus` (#211).

## Plan

1. [x] Add a reusable fail-closed test database target policy and unit tests.
2. [x] Make integration and E2E runners resolve only dedicated variables or the
       dedicated default.
3. [x] Assert the policy again inside direct integration/E2E setup boundaries.
4. [ ] Update CI and testing documentation, then run canonical verification.

## Progress

- 2026-08-23 23:58 JST — Started from `main`; confirmed both runners prefer an
  ambient `DATABASE_URL` and fixtures perform destructive cleanup.
- 2026-08-24 00:01 JST — Added the shared guard, dedicated environment
  resolvers, setup assertions, CI variables, documentation, and 11 unit tests.
- 2026-08-24 00:01 JST — `pnpm test:integration` passed 77 tests while an
  ambient development URL was present; the runner migrated `levi_test` and the
  development catalog remained at 55,075 verses.
- 2026-08-24 00:02 JST — An explicit `TEST_DATABASE_URL` targeting `levi`
  failed before database startup with the expected refusal.

## Decisions

- 2026-08-23 — Decision: require loopback PostgreSQL and database name
  `levi_test` at every destructive test entry point.
  - Reason: variable naming alone cannot prevent a mistyped or repointed URL.
  - Alternatives: only changing fallback order was rejected because direct
    Vitest/Playwright invocation could still target the development DB.

## Risks and mitigations

- Risk: CI relies on the generic URL today.
  - Mitigation: expose the same local service URL through `TEST_DATABASE_URL`
    and `E2E_DATABASE_URL` before removing runner fallback.

## Verification

- [x] Narrow unit run — 11 new guard cases passed; canonical unit suite pending.
- [x] `mise exec -- pnpm test:integration` — 77 tests passed.
- [ ] `mise exec -- pnpm test:e2e`
- [ ] `mise exec -- pnpm check`
- [ ] Required CI checks on the exact PR head
- [ ] Final diff reviewed for unsafe defaults and unrelated changes

## Handoff or blockers

- Completed: guard, runner/setup enforcement, CI variables, docs, unit and
  integration verification.
- Remaining: canonical check, CI, and merge.
- Blocker: none.
- Resume with: add the target guard and regression tests.

## Result

Pending.
