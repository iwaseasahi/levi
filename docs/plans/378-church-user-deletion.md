# Delete individual church users from administration

## Issue

- Issue: #378 (related: #357, #362)
- Branch: `codex/issue-378`
- Base commit: `d1c9e0f57ac29860b7cee095adc261263cb11f5c`

## Outcome

Administrators can confirm and delete an individual ACTIVE or PENDING church
user without deleting the church, its shared content, or other users.

## Context

`church-list.tsx` lists users; church deletion already uses transactional
authorization, Serializable retry, and cascading credential/session deletion.
ADR 0007 and the membership unique constraint restrict each user to one church.
ADRs 0012–0014 define separate admin authentication and password links.

## Constraints

Follow `docs/governance/autonomy.md` and `docs/testing.md`. Recheck admin status,
membership, and confirmation email inside the transaction. Audit only IDs and
outcomes. Use synthetic, isolated test data and discard mail transports.

## Non-goals

Production deployment or data deletion, schema changes, transfers, suspension,
multi-church membership, and resuming #59.

## Plan

1. [x] Inspect permissions, membership constraints, and existing deletion flow.
2. [x] Implement transaction, controller, server action, and accessible confirmation UI.
3. [x] Verify deletion scope, authorization, rollback, session/link revocation, and UI.
4. [ ] Document behavior, self-review, and merge only after all required CI passes.

## Progress

- 2026-08-31 JST — Created #378 and dedicated worktree, acquired writer lease.
- 2026-08-31 JST — Implemented the full deletion flow and focused regression tests.
- 2026-08-31 JST — Initial browser checks found Tab could leave the dialog for
  browser chrome; added explicit boundary cycling with component/E2E coverage.
- 2026-08-31 JST — A repeat E2E run encountered persisted admin rate-limit rows.
  Reset these alongside the existing church rate-limit fixture cleanup in the
  guarded disposable test DB. Production rate limits remain unchanged.
- 2026-08-31 JST — Final local checks passed, including all 21 E2E cases.

## Decisions

- Delete the User aggregate, including verifications, because a user has at most
  one church. Preserve even an empty church so administrators can invite again.
- Require the displayed email as confirmation; compare trimmed lowercase values
  consistently with account email normalization.
- Use the browser's modal dialog for focus containment and background isolation.
- Keep one vertical PR: reviewed the >500-line sizing signal; most additions are
  focused tests, with one deletion contract and rollback strategy. There are no
  schema, dependency, or independently deployable infrastructure changes to split.

## Risks and mitigations

- Wrong-tenant deletion: constrain lookup by both church and user IDs in the transaction.
- Partial deletion: one Serializable transaction plus rollback tests.
- Credential leakage: do not log form values or raw database errors.
- Accidental deletion: explicit email confirmation, cancel, pending lock, and focused tests.

## Verification

- [x] Unit/controller acceptance cases; 68 component tests passed.
- [x] `mise exec -- pnpm check` — format, lint, types, unit/component tests,
      configuration invariants and production build passed. DATABASE_URL and
      SHADOW_DATABASE_URL explicitly pointed to test PostgreSQL at port 55433.
- [x] `mise exec -- pnpm test:integration` — 96 tests passed; deletion scope,
      two-session revocation, link invalidation, authorization, last user and rollback.
- [x] `mise exec -- pnpm test:e2e` — 21 tests passed; confirmation, cancel/focus,
      responsive dialog, axe, deletion and refreshed list.
- [x] `mise exec -- pnpm security:check` — audit and 315-license inventory passed.
- [x] `mise exec -- pnpm test:unit:coverage` — statements 92.71%, branches 84.62%,
      functions 92.69%, lines 93.80%; thresholds passed.
- [ ] Final diff self-review and Quality / Database / E2E / Security at exact PR head

## Handoff or blockers

- Implementation, documentation and local verification complete. No blockers.
- Remaining: PR review evidence, exact-head required CI and merge.

## Result

Local acceptance passed. Production deployment and real data deletion remain out
of scope; #59 remains paused. Merge evidence will be recorded in the linked PR.
