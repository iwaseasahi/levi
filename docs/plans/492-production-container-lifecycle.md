# Make production container lifecycle history verifiable

## Issue

- Issue: #492
- Branch: `codex/issue-492`
- Base commit: `5fa69f88c8fa4d4058860f47b10b7eec336df8c9`

## Outcome

Record and summarize privacy-safe lifecycle samples for each production Compose
service so an operator can distinguish replacement, in-place restart, steady
state, and insufficient history for any requested period retained by journald.

## Context

- `scripts/run-production-health-monitor.sh` owns the root-only
  `/var/lib/levi-monitoring` state directory and sends its output to the bounded
  `levi-health.service` journal.
- `scripts/check-production-health.sh` currently records readiness, database,
  backup, capacity, storage, and 5xx evidence but no container lifecycle state.
- The 2026-09-06 Sunday baseline in
  `docs/operations/production-monitoring.md` could verify proxy and PostgreSQL
  restart counters, but the application container had been replaced after the
  requested interval and its prior lifecycle was no longer recoverable.
- Production runs one `proxy`, `app`, and `postgres` container in the fixed
  `levi-production` Compose project.

## Constraints

- Do not persist or emit container IDs, image names/digests, environment values,
  IP addresses, credentials, request data, raw logs, or church/user content.
- Keep lifecycle state root-only under the systemd-managed monitoring state
  directory and journal samples within the existing 14-day/200 MB retention.
- An expected deploy replacement must remain observable without automatically
  claiming an outage. A restart, unexplained replacement, malformed state, or
  monitoring coverage gap must have an explicit operator investigation rule.
- Production installation, service restart, timer change, or deployment remains
  approval-gated and is not part of this repository-only Issue.
- Follow ADR 0005 and `docs/governance/autonomy.md`.

## Non-goals

- Retaining Docker event streams or container identifiers.
- Expanding journal retention or adding a metrics provider.
- Automatically classifying a replacement as approved by reading or emitting
  deploy records that contain image metadata.
- Deploying the change to production.

## Plan

1. [x] Add a root-only lifecycle recorder that assigns service-local generation
       numbers and persists only creation/start times and restart counters.
2. [x] Run the recorder on every health-monitor invocation, including when the
       ordinary health check fails, and fail closed if lifecycle collection fails.
3. [x] Add an aggregate-only period summarizer that reports restart/replacement
       counts and explicitly rejects incomplete or malformed history.
4. [x] Extend disposable monitoring tests for initial, steady, restart,
       replacement, collection failure, privacy, complete summary, and insufficient
       coverage behavior.
5. [x] Document journal fields, period queries, retention limits, alert and
       investigation rules, production approval boundary, and rollback behavior.
6. [ ] Run canonical checks, review the complete diff, commit, push, open a pull
       request, and wait for required CI on the exact head.

## Progress

- 2026-09-07 JST — Started; read Issue #492, parent #302 and its completion
  evidence, governance, execution protocol, testing policy, ADR 0005, monitoring
  runbook, systemd units, health scripts, and monitoring/deployment checks.
- 2026-09-07 JST — Created the isolated `codex/issue-492` worktree from current
  `origin/main` and acquired the Issue writer lease.
- 2026-09-07 JST — Implemented root-only lifecycle state, per-minute journal
  samples, aggregate period validation, monitor failure routing, and the
  operations runbook.
- 2026-09-07 JST — Verified synthetic and real disposable Compose scenarios for
  initialization, steady state, in-place restart, replacement, malformed state,
  privacy, continuous coverage, and coverage gaps.
- 2026-09-07 JST — Opened PR #494. Its first exact-head CI passed Quality,
  Database, and Security but exposed the known nondeterministic Slide ordering
  assertion tracked by Issue #486, so the failed job was not retried.
- 2026-09-07 JST — Completed Issue #486 separately in PR #496 with all protected
  checks passing, then merged current `main` into this branch for a new
  exact-head verification.

## Decisions

- 2026-09-07 — Decision: use the container creation timestamp as a private
  comparison key and a service-local integer as the journaled generation.
  - Reason: Docker keeps creation time stable across an in-place restart and
    changes it for replacement, while the integer exposes no container or image
    identity.
  - Alternatives: persist or hash the container ID; rejected because the Issue
    explicitly excludes recording container identifiers and they are not needed.
  - ADR: none; this implements existing monitoring policy.
- 2026-09-07 — Decision: journal a heartbeat sample for all three services on
  every health run.
  - Reason: transition-only logs cannot prove that the recorder itself covered
    the start, end, and interior of an arbitrary requested period.
  - Alternatives: record only restart/replacement events; rejected because
    absence of an event would be indistinguishable from absent monitoring.
  - ADR: none.
- 2026-09-07 — Decision: observed replacement remains a successful health
  sample, while collection failure fails the health monitor.
  - Reason: approved deploys intentionally replace containers. The runbook can
    require correlation with an approved maintenance event without generating a
    false outage alert for every deployment.
  - Alternatives: fail health on every lifecycle transition; rejected because
    normal approved deploys would create incident/recovery alert noise.
  - ADR: none.
- 2026-09-07 — Decision: keep recorder, summarizer, monitor integration,
  rehearsal, tests, and runbook in one pull request after reviewing the sizing
  signal in the execution protocol.
  - Reason: they form one production-monitoring vertical slice with one rollout
    and rollback boundary. Most added lines are focused disposable tests and
    operational documentation.
  - Alternatives: land collection before query/rehearsal; rejected because that
    intermediate change would leave unverified collection or no operator-usable
    query path and would not satisfy the Issue.
  - ADR: none.

## Risks and mitigations

- Risk: lifecycle output leaks container or release identity.
  - Mitigation: exact allowlisted fields, strict parsing, privacy assertions,
    and root-only state files that contain no ID or image field.
- Risk: state corruption produces a false no-restart result.
  - Mitigation: validate the entire state schema and fail the monitor rather
    than reinitializing malformed state.
- Risk: a journal gap is interpreted as no lifecycle change.
  - Mitigation: the summarizer requires samples at both boundaries, continuous
    cadence within the allowed gap, and coverage beginning no later than the
    requested interval.
- Risk: simultaneous monitor invocations race state updates.
  - Mitigation: take a state-directory lock and write each state atomically.

## Verification

- [x] `pnpm monitoring:config:check` — lifecycle and existing Slack transition
      tests pass
- [x] `pnpm check` — format, lint, typecheck, unit/component, config, and build
      pass
- [x] `pnpm test:integration` — 26 files / 140 tests pass
- [x] `pnpm test:e2e` — 35 Chromium tests pass
- [x] `pnpm security:check` — audit and 356 license records pass
- [x] `pnpm backup:rehearse` — disposable encrypted backup/restore passes
- [x] `pnpm monitoring:lifecycle:rehearse` — real disposable Compose restart,
      replacement, steady state, and aggregate summary pass
- [x] `git diff --check` — patch whitespace passes
- [x] Acceptance: each service records generation, started-at, restart count,
      event, observation time, and coverage start without forbidden fields
- [x] Acceptance: requested periods report complete or insufficient coverage
      and distinguish restart from replacement
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: Issue intake, isolation, implementation, focused and canonical
  local verification, runbook updates, PR #494, and integration of the merged
  Issue #486 test stabilization.
- Remaining: new exact-head protected CI, merge, Issue closure, and local `main`
  synchronization.
- Blocker: none.
- Resume with: push the current head, mark PR #494 ready after CI starts, and
  merge only after all four protected checks pass.

## Result

Pending.
