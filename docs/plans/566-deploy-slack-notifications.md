# Observe automatic production releases through Slack

## Issue / outcome

- Issue #566; branch `codex/issue-566`.
- Base `a9eddac0efb6417fdc800ef68df5db3ac68643cd`.
- Owner accepted the Issue design on2026-10-27 and requested implementation.
- Owner selected workspace **JC Project**, private **#levi-deploy**, operator
  **岩瀬旭**. Workspace/channel IDs and the existing Slack App remain to inspect.
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
4. [ ] Integrate fixed observation hooks with the scheduled runner and authoritative
       host success; handle normal exit, signal, process death and restart recovery.
5. [ ] Add dormant systemd units and reviewed installer integration, preserving
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
