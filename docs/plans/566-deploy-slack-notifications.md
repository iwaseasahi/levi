# Observe automatic production releases through Slack

## Issue / outcome

- Issue #566; branch `codex/issue-566`.
- Base `a9eddac0efb6417fdc800ef68df5db3ac68643cd`.
- Owner accepted the Issue design on2026-10-27 and requested implementation.
- Owner selected workspace **JC Project**, private **#levi-deploy**, operator
  **岩瀬旭**. Confirmed workspace `T5V5BH4AF`, channel `C0CCB7UGHJS` and existing
  notification-bot; the new private channel has the operator as its only human member.
- Report start, actual successful application, failure/interruption/unknown and
  no-change outcomes without changing any deployment safety gate or outcome.

## Constraints / decisions

- Existing root VPS execution and host transaction remain authoritative.
- Fixed, allowlisted metadata only; no application data, arbitrary logs or secrets.
- Durable local events and a separate bounded-delivery worker; no HTTP under the
  deployment lock and no deployment retry triggered by notification failure.
- No production dependency or model; Python standard library and existing Bash.
- Root-owned installed code is updated explicitly, after review and exact CI.
- Source implementation is authorized. Review the exact credential/host/test-send
  changes before the separate production activation approval required by governance.
- No live deploy/outage as a test; no change to existing monitoring Slack routing.

## Plan

1. [x] Read Issue/dependencies, policies, tests, CI, ADR0018 and current execution.
2. [x] Create isolated worktree/branch and writer lease; resolve workspace/operator.
3. [x] Record the durable notification architecture and implement private event
       state, delivery, bounded retries and privacy guards with synthetic tests.
4. [x] Integrate fixed observation hooks with the scheduled runner and authoritative
       host success; handle normal exit, signal, process death and restart recovery.
5. [x] Add dormant systemd units and reviewed installer integration, preserving
       explicit activation and existing manual/deployment checks.
6. [ ] Run focused/canonical/exact-head protected checks; review and prepare PR.
7. [ ] Inspect non-secret Slack target IDs, prepare concrete protected setup and
       test procedure; request only the remaining exact activation approval.
8. [ ] After approval, install and verify fixed synthetic notification delivery
       without running an immediate production deployment; record evidence.

## Progress / sizing

- 2026-10-27 — Intake and base inspected. The installed production scheduler is
  root-owned; its child snapshots and env-cleared host call require explicit
  observation integration. A workflow success alone is not deployment proof.
- 2026-10-27 — Implementation will keep event storage/delivery independent of
  host state ownership. Large synthetic tests are expected; review queue/security
  and host-integration changes separately within the PR and assess splitting at
  the first coherent commit. No runtime or secret has changed.
- 2026-10-27 — Split delivery into two sequential PRs on this Issue branch:
  private observer/outbox/transport and its regression suite first, then actual
  Bash hooks/units/installer and operational integration. The dormant core is
  independently verifiable; neither source merge activates production delivery.
- 2026-10-27 — Core synthetic cases cover process/host proof, no-op, signal/dead
  process, safe recovery, five-attempt/24-hour limits, redaction, credential modes,
  origin/redirect rejection, queue locking, duplicate suppression and fixed test.
- 2026-10-27 — Read-only Slack inspection confirmed JC Project `T5V5BH4AF`,
  existing #monitoring `C015A32HDM4` and notification-bot. Its route is unchanged.
- 2026-10-27 — Foundation PR #567 merged as
  `2676c333296d4fc531ac918f47819b0226f4c829` after exact-head four protected jobs
  passed in run40441707393. Core now has51 synthetic cases including zombie recovery.
- 2026-10-27 — Integration safeguards passed29 orchestration cases,23 host
  transactions,11 existing App authentication tests and3 installation/hook tests.
  `mise run check` passed (587 unit,129 component, all config guards and build).
- 2026-10-27 — Real CLI/kernel checks passed in isolated Linux: success, exit17
  failure, skip, live-owner protection, SIGKILL/zombie recovery, repeated recovery
  and PID reuse. Ubuntu24.04/Python3.12 verified all four systemd255 units and
  the next Tuesday10:00 JST calendar. No real Slack/deployment call occurred.
- 2026-10-27 — Created the approved private #levi-deploy `C0CCB7UGHJS` in
  JC Project. Only the operator participates; description marks setup pending.
  No Webhook, credential, host change or outbound notification has occurred.

## Verification

- [ ] Synthetic state/transport/permission/timeout/retry/redaction cases.
- [ ] Real Bash orchestration fixtures, including notification failures and no-op.
- [ ] Existing deployment/monitoring configuration guards and unit syntax.
- [ ] Canonical `pnpm check`, applicable integration/E2E/security and exact CI.
- [ ] Final scope/security/concurrency review and approved activation evidence.

## Handoff or blocker

- Completed: intake, isolated writer, approved design and named Slack target.
- Remaining: implementation, verification, reviewed merge and exact activation.
- Blocker: none for code. Do not expose any credential or post to Slack during tests.
- Decision needed: exact protected production setup approval after reviewable PR.
- Resume with: implement and test the event store/worker, then integration.
