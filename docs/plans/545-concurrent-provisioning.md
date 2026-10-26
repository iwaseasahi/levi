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
2. [ ] Reproduce using synthetic data and record attempt/classification evidence.
3. [ ] Implement the smallest root fix with deterministic regression coverage.
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

## Handoff or blockers

- Completed: intake and failure evidence.
- Remaining: reproduction, root fix, focused tests and protected CI.
- Blocker: none; investigating.
- Resume with: instrument synthetic retry attempts and run the concurrency test.
