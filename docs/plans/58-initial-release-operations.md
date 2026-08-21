# Initial-release backup, recovery, and cutover preparation

## Issue

- Issue: #58
- Branch: `codex/issue-58`
- Base commit: `e2af850`
- Human selection gate: #81

## Outcome

Without touching production, Levi has a versioned, machine-checkable release
plan for backup/restore, migration ordering, failure stops, recovery,
monitoring, communication, and immediate human approvals.

## Constraints

- Do not select, purchase, provision, or access a production provider.
- Do not create, rotate, read, or transmit production credentials.
- Do not execute a production deploy, migration, import, restore, or
  communication.
- Keep pending human decisions explicit; a dry-run must not convert them into
  implied approval.
- Initial release has no outbound email provider.

## Plan

1. [x] Create the human selection Issue for hosting, region, PostgreSQL,
       backup, secret store, monitoring, cost, and ownership.
2. [x] Define RPO/RTO, backup/restore, session/temporary-credential recovery,
       cutover order, compatibility window, and stop conditions.
3. [x] Define smoke/monitor/alert/incident ownership, rollback versus forward
       recovery, and before/after user communication templates.
4. [x] Add a versioned release manifest plus fail-closed dry-run validator and
       tests that prove required gates and exact step order.
5. [ ] Run backup restore, synthetic cutover/checklist, local quality, and
       exact-commit CI before merge.

## Progress

- 2026-08-21 20:21 JST — Started automatically after Issue #57 merged; read the
  deployment gate, open decisions, cutover options, backup, incident,
  observability, readiness, and governance contracts; acquired the writer
  lease.
- 2026-08-21 20:23 JST — Opened Issue #81 as the explicit human gate for
  production hosting, region, database, backup, secret, monitoring, cost, and
  ownership selection.
- 2026-08-21 20:32 JST — Added the cutover/recovery runbook, versioned release
  manifest, fail-closed validator, and a 13-step synthetic walkthrough. Local
  backup restore, 165 unit/component tests, nine latest-Chrome E2E scenarios,
  production build, security audit, and license gate passed. No production
  action or secret was used.

## Decisions

- 2026-08-21 — Decision: prepare a single-cutover runbook but keep the strategy
  and production target pending human approval.
  - Reason: only the static Bible catalog migrates from Ginmaku and no retained
    mutable legacy workflow requires dual writes; production topology and
    downtime tolerance are still unknown.
- 2026-08-21 — Decision: set release-entry objectives of RPO ≤ 60 minutes and
  RTO ≤ 120 minutes as provider acceptance requirements.
  - Reason: they bound account/bookmark loss and worship-service recovery while
    remaining subject to cost/provider proof and explicit human acceptance in
    #81.
- 2026-08-21 — Decision: a restored environment invalidates all sessions and
  requires operator-led credential remediation where the recovery point may
  predate a password change.
  - Reason: restoring sessions or password state can otherwise resurrect
    revoked access or make credential state ambiguous.

## Verification

- [x] `pnpm backup:rehearse`
- [x] `pnpm release:checklist:dry-run`
- [x] fail-closed manifest unit tests
- [x] `pnpm check`, `pnpm security:check`
- [ ] exact-head `Quality`, `Database`, `E2E`, `Security`

## Handoff or blockers

- Completed: intake, operations contracts, explicit selection Issue, runbook,
  manifest/validator, tests, local rehearsals, and local quality gates.
- Remaining: exact-commit CI and merge.
- Human blocker for production only: Issue #81 and immediate action approvals.
- No blocker for repository-only preparation.
