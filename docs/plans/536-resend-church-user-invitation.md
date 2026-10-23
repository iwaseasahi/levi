# Resend pending church-user invitations

## Issue

- Issue: #536 (related #340, #376)
- Branch: `codex/issue-536`
- Base commit: `5cad3f8`

## Outcome and constraints

An active administrator can resend setup mail to a pending user of an active
church from the church directory. Use ADRs 0013/0014, existing Better Auth token
semantics, 72-hour validity and isolated test mail. No schema/dependency changes,
production actions, administrator invitation changes, or copied reference data.

## Plan

1. [x] Inspect invitation, access, directory, mail and test boundaries.
2. [x] Add guarded resend and old-token replacement with failure rollback and
       per-user cooldown; test authorization, lifecycle and concurrency.
3. [x] Add accessible per-row resend feedback, pending state and responsive controls.
4. [ ] Verify unit/component/integration/E2E and canonical checks; review final
       diff, record evidence in PR and observe CI.

## Decisions

- 2026-10-23 — Resend only for PENDING identities in ACTIVE churches. Read the
  recipient from storage. Preserve existing identity/membership on failure.
- 2026-10-23 — Serialize resends by locking the target identity; shared locks on
  administrator/church/membership prevent lifecycle changes during delivery.
  Replace tokens using the existing Better Auth adapter inside the transaction.
  Do not retry a transaction containing external delivery. A successful resend
  starts a 60-second cooldown, including parallel requests.
- 2026-10-23 — Display a keyboard-operable form inline, disable during delivery,
  announce feedback within the target row, and allow controls to wrap on mobile.

## Progress

- 2026-10-23 JST — Intake complete; created #536 and isolated worktree.
- 2026-10-23 JST — Implemented guarded resend, 60-second cooldown, token
  replacement/rollback, inline form, status feedback and operator documentation.
- 2026-10-23 JST — Unit/controller/component tests pass. Integration initially
  exposed a synthetic expiry fixture violating the DB constraint and Better Auth
  swallowing mail errors; fixed fixture dates and explicitly awaited delivery
  after the framework callback. Full integration: 145 tests pass.
- 2026-10-23 JST — `pnpm check`, coverage (552 unit tests; lines 93.58%), security
  and backup rehearsal pass. Security reports only existing moderate advisories
  tracked in #534. Existing invitation false-success risk recorded in #537.
- 2026-10-23 JST — E2E proves resend → old-link rejection → setup → login.
  Updated ambiguous selectors for the new control/framework announcer. Tablet
  layout exposed insufficient status-column width; reserved 8rem for its controls.
  A separate Slide sidebar response timeout matches existing #517; preserved
  trace/video/context locally under `.agent-runs/536-e2e-failure/`.
- 2026-10-23 JST — A later local E2E run overlapped `pnpm check` and repeatedly
  navigated during checks. `next-env.d.ts` was rewritten at 11:57:28 by typegen
  while the dev server was running. Interrupted that contaminated run (exit 130),
  preserved logs in `.agent-runs/536-concurrent-verification/`, and serialized all
  Next type generation/build and browser validation. This is verification setup
  interference, not acceptable passing evidence.

## Verification

Pending implementation and checks. Unit/controller tests cover rejected access,
invalid IDs, lifecycle errors, cooldown and generic failures. Integration tests
prove token replacement/expiry/single-use, rollback and concurrent resends.
Mailpit E2E proves the resent link completes setup and login. Component tests
cover conditional rendering, scoped IDs, pending state and feedback.

## Risks and mitigations

- SMTP and database commits cannot be atomic: mail accepted just before a DB
  commit failure may contain an invalid link; surface failure and allow retry.
- Bound SMTP connection/greeting/socket timeouts (5s/5s/10s) and transaction
  lifetime (30s); never automatically retry mail.
- Roughly 800 added lines were reviewed for splitting: most are focused tests;
  the remaining code is one resend flow with one rollback. Splitting the UI and
  guarded delivery would not yield independently useful acceptance evidence.
- Logs contain only outcome and approved opaque audit IDs.

## Handoff or blockers

- Completed: intake and design.
- Remaining: implementation, tests, checks and PR.
- Blocker: none.
- Resume with: implement the resend boundary.
