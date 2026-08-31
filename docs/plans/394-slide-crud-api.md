# Authorize and serialize Slide CRUD

- Issue #394; parent #384/#59; dependencies #382/#383 merged.
- Branch `codex/issue-394`; base `a0a11a1`.

## Plan

1. [x] Inspect accepted contracts, current branded scope/auth/repositories, and
       installed Next 16.3.1 route/page/server-client documentation.
2. [x] Add strict commands and scoped service/repository; row-lock revision
       mutation prevents concurrent overwrites and reveals no foreign existence.
3. [x] Add no-store HTTP adapters, configured exact-Origin writes, bounded/fatal
       UTF-8 JSON decoding and content-free status logging.
4. [ ] Prove HTTP allowed/denied/input/size/error and database concurrency/tenant
       cases; run check/integration/security/E2E and separate review.
5. [ ] Exact-head CI/PR merge and return to #384 UI; final results in PR.

## Decisions and constraints

The current church API helper authenticates but contains no explicit mutation
Origin guard. Slides get an exact canonical-origin check from the existing
validated auth configuration; do not assume copying the bookmark API is enough.
PUT accepts `{input, expectedRevision}`, DELETE `{expectedRevision}`; create
accepts only SlideInput. No ownership/revision assignments from clients.

This is the independently mergeable high-risk API half of #384. No UI, search,
projection, production changes, migrations, dependencies, or real content.
The existing Page/E2E behavior remains unchanged.

## Handoff

- Completed: intake and API implementation.
- Remaining: focused tests, review, local/CI gates and merge.
- Blocker: none. Resume with the HTTP and transaction regression suites.

- Local checks: `pnpm check` passed 392 unit and 70 component tests and build;
  `pnpm test:integration` passed 125 tests; new service/command modules have
  100% coverage and API controller 100% lines/branches. Security audit and 315
  license records passed. Added real-route cookie/Origin/revision/delete E2E.
- Strict typecheck caught an optional fixture Request body; used conditional
  property omission. A standalone typecheck needed synthetic database env;
  reran through the same explicit local environment as canonical check.
- Separate review checked row locking, denied/foreign identity, revision
  exhaustion/rollback, bounded streaming/UTF-8, no-store, content-free error and
  logging paths. No migrations, new dependencies or production operations.
- Final E2E and exact-head CI/merge results are recorded in the linked PR.
