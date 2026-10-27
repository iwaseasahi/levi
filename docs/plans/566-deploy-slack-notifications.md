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
6. [x] Run focused/canonical/exact-head protected checks; review and merge PR.
7. [x] Inspect non-secret Slack target IDs, prepare concrete protected setup and
       test procedure; request only the remaining exact activation approval.
8. [x] After approval, install and verify fixed synthetic notification delivery
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

- 2026-10-27 — Final integration review checked host-ready ordering, manual nonce
  clearing, bounded delivery, secret separation and additive installer behavior.
  Added explicit ready/apply evidence assertions. The observer clock failure
  falls back to the original Bash time guard. Focused core now52 cases.
- 2026-10-27 — Standalone typecheck initially lacked synthetic DATABASE_URL;
  rerun with the same synthetic values as mise check passed. No real credential
  was used. Format, lint and focused deployment configuration checks also passed.

- 2026-10-27 — Integration PR #568 merged as
  `7124e8f93538dc8744b265a8361b81aba7a48cce`. Final PR head
  `93a5cc60496ca1166d73fdb1e3d46f502d243275` passed all four protected jobs
  in run40443433053. Primary main was fast-forwarded and is clean.
  Issue comment6432953185 records source completion and the exact remaining
  production activation boundary. Existing installed bundle remains37acf879.

- 2026-10-27 — Merged commit7124e8f passed all four jobs in main CI
  run40443858447 as well. Requested one exact approval for the existing
  notification-bot channel Webhook, root600 placement, reviewed host bundle/4
  units, timer activation and one fixed non-sensitive test. The owner subsequently
  selected the existing notification-bot App `A015P0E6KC4` and confirmed adding
  the #levi-deploy channel-specific Webhook. Host placement/install/test remains pending.

- 2026-10-27 — Prepared a one-time, hash-verified setup for existing operator
  sudo authentication and human hidden-TTY Webhook entry directly on the VPS.
  No credential is read into the agent workspace or command arguments. Synthetic
  checks verify workspace/origin validation, atomic non-overwrite,0600 mode,
  symlink rejection and temporary cleanup; Bash syntax checks pass. The source
  installs only reviewed7124e8f, preserves the previous scheduler, uses a dry-run,
  enables timers only and queues one fixed notification test. Human inputs pending.

- 2026-10-27 — First human setup stopped before credential entry because
  Python buffered r+ cannot open a non-seekable TTY. No runtime/timer changed.
  Reproduced the pre-prompt failure in isolated Linux, changed the prompt stream
  to line-buffered output, and verified actual controlling-TTY hidden entry,
  absence of echo and root0600 creation. Updated the hash-verified helper for
  retry through the same owner command.

- 2026-10-27 — Second owner input attempt reached the hidden prompt but failed
  afterward before any runtime/timer replacement. Slack-side target URL shape
  was checked through boolean-only DOM diagnostics and is valid; no URL value
  was output. Added three bounded hidden-input attempts and allowlisted
  exception/errno diagnostics. Real Linux PTY tests cover valid-after-invalid
  input and three rejections without echo/file creation. Updated provisioner
  SHA95782780; third owner attempt requested. Public readiness remains ready,
  installed bundle37acf879 and next trigger2026-11-03 10:00 JST unchanged.

- 2026-10-27 13:27 JST — Owner completed the prepared setup. VPS phase is
  `installed-timers-active-and-fixed-test-delivered`; installed bundle7124e8f,
  both timers active/enabled and next release2026-11-03 10:00 JST. One test
  event `01c04cbf27c14accae0581c5d15aebe1:test` is sent, with pending/dead0.
  Verified the same event and fixed test text in the private Slack channel.
  Host/GitHub ready metadata and application commita9eddac stayed unchanged;
  public readiness/database checks pass. Release service last started at10:00
  JST, confirming no immediate deploy. Operational evidence now recorded in
  both runbooks; documentation handoff PR will close the Issue after exact CI.

## Verification

- [x] Synthetic state/transport/permission/timeout/retry/redaction cases (52).
- [x] Real Bash orchestration fixtures, including notification failures and no-op.
- [x] Existing deployment/monitoring configuration guards and unit syntax.
- [x] Canonical `pnpm check`, applicable integration/E2E/security and exact CI.
- [x] Final scope/security/concurrency review and approved activation evidence.

## Handoff or blocker

- Completed: implementation PRs #567/#568, exact-head source CI, protected owner
  setup, installed bundle7124e8f, active timers and actual fixed-test receipt.
- Remaining: none for implementation or production activation. The final
  documentation record is subject to the normal protected PR merge gate.
- Blocker: none. No further production action or test send is required.
- Resume with: N/A after the documentation PR merges and #566 closes. Normal
  Tuesday execution is independent of this agent session.

## Result

JC Project private #levi-deploy receives scheduled release notifications through
existing notification-bot. Readiness remains normal and the first real scheduled
notification uses the next ordinary Tuesday10:00 JST run. This setup added no
new GitHub access, SSH route, sudo grant or production dependency.
