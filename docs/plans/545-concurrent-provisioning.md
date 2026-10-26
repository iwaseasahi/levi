# Stabilize concurrent church provisioning without weakening transaction policy

## Issue

- Issue: #545, prerequisite for #541 / #542
- Branch: `codex/issue-545`
- Base: `ed9570a8affec3fa8ca5c139ada2d5312d91022c`
- Prior policy: #184, #192; parent #189 and dependency #191 read.

## Outcome and constraints

Identify the observed P2034/40001 failure in concurrent provisioning and fix the
root cause, keeping the three-attempt limit, Serializable isolation, atomicity,
authorization, safe error mapping and test retries=0. No schema, workflow or
production changes. Governance, testing policy and database conventions apply.

## Plan and progress

1. [x] Inspect the failing CI job, existing policy and test; create scoped worktree.
2. [x] Reproduce using synthetic data and record attempt/classification evidence.
3. [x] Implement the smallest root fix with deterministic regression coverage.
4. [ ] Verify focused concurrency, canonical checks and exact-head protected CI.
5. [ ] Merge prerequisite and resume #541.

## Evidence

- CI run 40255552060 failed `completes concurrent provisioning for distinct
churches` at ChurchMembership insertion with Prisma P2034 / PostgreSQL 40001.
- All other integration tests passed. Quality, Security and E2E also passed.
- Existing retries recognize Prisma errors using instanceof and driver conflicts
  using Error/name/cause.kind, with three immediate transaction attempts.
- Cause is not yet confirmed: distinguish exhausted retries from failed error
  recognition before changing code. No rerun-to-green evidence will be used.

## Diagnostic progress

- Local full integration passed 145/145. A separate 40-case concurrency stress
  run observed recognized driver conflicts and P2034 conflicts, always on the
  first attempt, with all 40 independent cases passing. This does not explain
  the CI failure and is not used as rerun-to-green evidence.
- A draft diagnostic commit runs 200 independent concurrency cases with safe
  attempt/error-code/type diagnostics in CI to distinguish recognition failure
  from exhaustion. Diagnostic logging and stress expansion must be removed before
  a final fix is marked ready.

## Confirmed defect and final change

- Native Node loading of Prisma's CJS and ESM runtime entry points shows distinct
  `PrismaClientKnownRequestError` constructors. A genuine alternate-entry-point
  P2034 is an Error with the expected name/code/clientVersion, but fails the
  existing instanceof check and escapes on attempt 1.
- A deterministic unit test using those genuine installed Prisma constructors
  failed before the fix (1 failed / 9 passed) and passes after it. No invented
  error class or retry-to-green result is used for this evidence.
- Match actual Error instances with Prisma's known-error name, P2034 code and
  string clientVersion metadata. Keep the three-attempt limit, DriverAdapterError
  handling, transaction boundaries and Serializable isolation unchanged.
- The original CI job had no attempt counters, so its exact runtime constructor
  cannot be recovered retrospectively. The confirmed classifier defect explains
  a path by which a genuine P2034 escapes before the intended retry. The bounded
  exhaustion behavior remains explicitly tested, including alternate runtimes.
- Remove all diagnostic logging, hash gates and expanded stress cases from the
  final diff. The real concurrent provisioning integration scenario stays intact.
- The latest diagnostic CI run passed all four jobs; this is investigation
  evidence only. A new exact-head run is required for the actual fix.

## Final local verification

- `pnpm exec vitest run --config vitest.config.ts src/infrastructure/database/serializable-retry.test.ts`: 12/12 pass.
- `pnpm test:integration`: 145/145 pass, including real concurrent provisioning
  and allowed/denied authorization cases; retries remain zero.
- `mise run check` (`pnpm check`): 558 unit tests, 129 component tests, formatter,
  ESLint, route types/TypeScript, configuration guards and production build pass.
- Final diff against main contains only the retry classifier, its focused tests
  and this execution plan. No diagnostic code, stress expansion, new dependency,
  schema change, transaction/isolation change or attempt-limit change remains.
- `git diff --check`: pass. Exact-head CI evidence and completion are recorded
  in the linked PR after publication.

## Handoff or blockers

- Completed: intake, diagnostic investigation and deterministic reproduction of
  the confirmed dual-runtime classifier defect; minimal fix and 12 unit cases.
- Remaining: exact-head protected CI and merge; then resume #541 / #542.
- Blocker: none; investigating.
- Resume with: inspect the linked PR’s final exact-head checks before merge.
