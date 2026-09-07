# Record the first real Sunday production baseline

## Issue

- Issue: #302
- Branch: `codex/issue-302`
- Base commit: `2a8223d4a1f5102ff947917efac48c7ee538bbe9`

## Outcome

Record a privacy-safe baseline from the first real Sunday use on 2026-09-06 JST,
show whether the single-VPS capacity and monitoring thresholds were sufficient,
and move any required capacity, monitoring, or runbook improvement into a
follow-up Issue.

## Context

- `docs/operations/production-monitoring.md` contains the idle post-launch
  baseline and requires real Sunday CPU, memory, disk, latency, and error
  measurements to be recorded separately.
- `scripts/check-production-health.sh` records readiness, database, disk,
  memory, storage, backup, and rolling five-minute 5xx results in the bounded
  system journal.
- Caddy emits JSON access logs from which anonymous request counts, response
  status counts, and duration percentiles can be aggregated without retaining
  request paths, IP addresses, headers, or log records.
- ADR 0005 requires reconsideration if real traffic produces sustained memory
  above 75%, swap pressure, database connection pressure, or unacceptable p95
  latency.
- The product owner reported that the system was first used on Sunday,
  2026-09-06 JST.

## Constraints

- Production inspection is read-only. Do not deploy, restart services, change
  configuration or data, or create persistent files on the VPS.
- Do not print, copy, or record raw logs, IP addresses, credentials, email
  addresses, request paths, Bible text, church identifiers, or other personal
  data. Only anonymous counts, percentages, durations, and health states may be
  retained.
- Treat 2026-09-06 00:00:00 through 2026-09-07 00:00:00 JST as the enclosing
  Sunday interval. Derive any narrower activity window only from anonymous
  request counts by time bucket.
- Follow `docs/governance/autonomy.md` and
  `docs/governance/agent-execution-protocol.md`; production mutation remains an
  approval-gated action and is outside this Issue.

## Non-goals

- Replaying production traffic or using production data as a test fixture.
- Changing production monitoring thresholds without separate evidence and
  review.
- Deploying an application, migration, monitoring unit, or runbook change.
- Claiming an SLA from a single Sunday measurement.

## Plan

1. [x] Verify the observation window and available retained production signals
       using read-only, aggregate-only commands.
2. [x] Aggregate before/during/after capacity, latency, request/5xx, readiness,
       database, backup, container restart, and failed-unit evidence without
       exposing raw logs.
3. [x] Compare observations with current thresholds and the idle/synthetic
       baselines; create a follow-up Issue for every evidenced gap.
4. [x] Update `docs/operations/production-monitoring.md` and this plan with the
       measured Sunday baseline and exact verification evidence.
5. [ ] Run applicable documentation checks, review the complete diff, commit,
       push, open a pull request, and wait for required CI on the exact head.

## Progress

- 2026-09-07 JST — Started; read Issue #302, parent #280, dependencies #86 and
  #87, parent epic #274, governance, execution protocol, relevant operations
  docs, ADRs 0005/0015/0016, and the production health implementation.
- 2026-09-07 JST — Created the isolated `codex/issue-302` worktree from current
  `origin/main` and acquired the Issue writer lease.
- 2026-09-07 JST — Verified read-only SSH connectivity and existing historical
  `sysstat` data. The completed Sunday JST aggregation later established 1.52%
  average and 2.32% maximum host CPU use across the retained samples.
- 2026-09-07 JST — Stopped production inspection after the SSH client emitted
  sensitive connection metadata into private tool output while closing an
  authentication attempt. The value was not copied into the repository,
  GitHub, or any retained evidence.
- 2026-09-07 JST — Resumed after operator acknowledgement and used a
  human-authenticated, read-only remote collector. Evidence: complete Sunday
  access-log and health-journal coverage; 1,995 non-readiness requests; p95
  117.3 ms; zero 5xx; CPU maximum 2.32%; memory maximum 23%; disk 6%; 1,224
  successful health samples and zero error-priority health events.
- 2026-09-07 JST — Confirmed post-use public readiness, PostgreSQL, and backup
  health; all three production timers were active and systemd had zero failed
  units. The current application container was created after the observation
  window, so historical application restart proof is unavailable.
- 2026-09-07 JST — Created follow-up Issue #492 for privacy-safe, durable
  per-service restart and replacement history.
- 2026-09-07 JST — The operator confirmed that no client-visible projection
  interruption, rendering problem, or control failure occurred during the
  measured use.
- 2026-09-07 JST — `pnpm check`, `pnpm test:integration`,
  `pnpm security:check`, and `pnpm backup:rehearse` passed. Full E2E completed
  34 of 35 tests; the one failure is the existing equal-timestamp random-UUID
  assertion tracked by Issue #486, not this documentation change. The failure
  was retained rather than retried into a passing result.
- 2026-09-07 JST — Completed a separate final-diff review: only the monitoring
  runbook and Issue plan changed; request/status/window totals reconcile; no IP
  or email literal, migration, runtime code, deployment, or production state
  change is present.

## Decisions

- 2026-09-07 — Decision: use the full Sunday JST interval as the outer query
  bound and retain only aggregate results.
  - Reason: the supplied evidence identifies the date but not a clock-time
    window, and access-log timestamps can locate activity without inspecting
    identities or request content.
  - Alternatives: ask the operator to estimate the time before inspecting
    already-retained anonymous evidence; rejected because it is unnecessary and
    less reproducible.
  - ADR: none; this is an observation method, not a durable architecture choice.
- 2026-09-07 — Decision: define 08:30–16:00 JST as the observed traffic
  envelope, with concentrated periods at 08:30–13:00 and 14:30–16:00.
  - Reason: anonymous half-hour request counts increased materially in those
    intervals; the envelope preserves the midday gap when comparing capacity
    without inspecting request paths or user identity.
  - Alternatives: identify sessions, users, churches, or routes; rejected as
    unnecessary and inconsistent with the privacy boundary.
  - ADR: none; this labels measured evidence only.
- 2026-09-07 — Decision: do not infer application restart history from the
  current container.
  - Reason: the current application container was created after the Sunday
    interval, although the proxy and PostgreSQL containers predate it and have
    zero restarts. Availability evidence is complete, but application lifecycle
    history is not.
  - Alternatives: treat zero readiness/5xx errors as proof of zero restarts;
    rejected because a fast restart could occur between checks.
  - ADR: follow-up Issue #492 owns any durable monitoring change.

## Risks and mitigations

- Risk: access logs contain Restricted or Confidential request metadata.
  - Mitigation: parse and aggregate on the VPS; never emit raw records, paths,
    addresses, headers, query strings, or identifiers.
- Risk: current snapshots are mistaken for historical measurements.
  - Mitigation: label every result by its actual source and interval; report an
    unavailable historical signal as a monitoring gap rather than estimating it.
- Risk: observation accidentally changes production state.
  - Mitigation: use only read-only commands and avoid service execution,
    restarts, configuration writes, database queries over content, or cleanup.

## Verification

- [x] `pnpm check` with synthetic local database URLs — format, lint,
      typecheck, 530 unit tests, 121 component tests, configuration checks, and
      production build pass
- [x] `pnpm test:integration` — 140 tests pass after applying all 23 migrations
      to the disposable test database
- [ ] `pnpm test:e2e` — 34 tests pass; one unrelated nondeterministic pagination
      assertion fails as tracked by Issue #486; exact-head protected E2E is pending
- [x] `pnpm security:check` — audit has no high/critical findings and all 356
      production dependency licenses are approved
- [x] `pnpm backup:rehearse` — encrypted backup, isolated restore, session
      invalidation, and Slide reconciliation pass in the disposable environment
- [x] `git diff --check` — patch whitespace passes
- [x] Acceptance: CPU, memory, disk, latency, HTTP 5xx, readiness, database,
      backup, container restarts, and systemd failures are recorded or an explicit
      evidence gap is transferred to a follow-up Issue
- [x] Acceptance: the runbook contains only aggregate, non-sensitive evidence
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake, isolated worktree, aggregate production observation,
  threshold analysis, projection-outcome confirmation, runbook update, and
  follow-up Issue #492; all local gates except the known Issue #486 E2E
  assertion completed.
- Remaining: review, commit, push, open the pull request, and wait for exact-head
  protected CI, including E2E.
- Blocker: none.
- Resume with: run documentation and canonical verification.

## Result

The complete 2026-09-06 JST window retained access and health evidence. The
observed 08:30–16:00 traffic envelope handled 1,526 non-readiness requests with
zero 5xx, half-hour p95 at or below 193.4 ms, CPU at or below 2.32%, memory at
or below 23%, and disk at 6%. Full-day latency was p50 30.0 ms and p95 117.3 ms.
Public readiness, PostgreSQL, backups, timers, and systemd were healthy after
use, and the operator observed no projection problem. The current capacity and
thresholds are sufficient for this measured two-church baseline. Durable
application container lifecycle history remains follow-up Issue #492; no
capacity or threshold change is required by this evidence.
