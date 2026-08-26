# Run hourly external monitoring with Slack incident notifications

## Issue

- Issue: #333
- Branch: `codex/issue-333`
- Base commit: `8c6da1108a7ed8f2503601e12331f39f1c3a139a`

## Outcome

Production is checked externally once per hour, external failures are sent to
Slack, and VPS-side detailed checks notify Slack once when an incident starts
and once when it recovers.

## Context

- `.github/workflows/production-smoke.yml` checks public readiness every 15 minutes.
- `levi-health.timer` checks readiness, PostgreSQL, backups, capacity, and 5xx
  responses every minute on the VPS.
- `docs/operations/production-monitoring.md` defines alert ownership and current
  monitoring limitations.

## Constraints

- Slack webhook URLs are secrets and must not be committed, printed, or included
  in notification content.
- A fully unavailable VPS cannot send its own alert; the external GitHub Actions
  check must cover that failure mode.
- Repository changes may be merged after required CI, but production secret or
  service changes require separate human approval.

## Non-goals

- Adding a paid monitoring provider or staging environment.
- Changing existing health thresholds.
- Deploying this change or creating the Slack webhook.

## Plan

1. [x] Change the external readiness schedule to hourly and notify Slack on failure.
2. [x] Add stateful VPS-side Slack notifications for incident and recovery transitions.
3. [x] Add configuration checks and behavioral regression coverage.
4. [x] Update the monitoring runbook with setup, security, behavior, and limitations.
5. [ ] Merge PR #334 after required CI and close the Issue.

## Progress

- 2026-08-26 16:29 JST — Started; inspected the current workflow, systemd timer,
  health script, monitoring environment example, and runbook.
- 2026-08-26 16:41 JST — Implemented hourly external checks, failure alerts,
  VPS incident/recovery deduplication, configuration validation, tests, and the
  Slack operations runbook.
- 2026-08-26 16:48 JST — PR #334 passed Quality, Database, E2E, and Security on
  implementation commit `c6d9e13`.

## Decisions

- 2026-08-26 — Decision: Keep the VPS detailed check at one-minute intervals and
  change only the external server-aliveness check to hourly.
  - Reason: Internal checks detect database, backup, capacity, and error-rate
    failures; reducing those checks would weaken diagnosis without reducing the
    externally visible monitoring frequency requested by the operator.
  - Alternatives: Run every check hourly; rejected because local checks are cheap
    and include signals unavailable to the external monitor.
- 2026-08-26 — Decision: Use Slack Incoming Webhooks with fixed, non-sensitive
  messages and transition-based deduplication on the VPS.
  - Reason: This avoids a new runtime dependency, keeps the secret out of message
    content, and prevents one-minute alert storms.

## Risks and mitigations

- Risk: A webhook value leaks through logs.
  - Mitigation: Never echo the URL, validate its Slack host and path, and test
    source/configuration guards.
- Risk: Repeated failures create notification noise.
  - Mitigation: Persist incident state in a root-only systemd state directory.
- Risk: GitHub scheduled workflows are delayed or unavailable.
  - Mitigation: Document that the schedule is best effort and retain VPS-side checks.

## Verification

- [x] `pnpm deployment:config:check` — passed
- [x] `pnpm monitoring:config:check` — passed
- [x] `pnpm security:check` — passed; no known high vulnerabilities and 314
      approved production dependency license records
- [x] `pnpm check` through all checks before build — passed; 317 unit/component
      tests passed. The local `.env` made the final build reject an HTTP production
      auth origin, so the build was rerun with the same synthetic HTTPS auth values
      used by CI and passed.
- [x] `git diff --check` — passed
- [x] Required GitHub checks: Quality, Database, E2E, Security — passed on
      `c6d9e13`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: Implementation, focused tests, full local checks, security check,
  documentation, and final build verification.
- Remaining: Commit, PR, required CI, merge, and Issue closure.
- Blocker: None for repository work. Production activation will require a
  separately approved Slack webhook and production configuration change.
- Resume with: Update the workflow and add the transition notification wrapper.

## Result

Repository implementation and verification are complete in PR #334. Production
activation remains intentionally separate because creating the GitHub/VPS
secrets and changing the running service require explicit operator approval.
