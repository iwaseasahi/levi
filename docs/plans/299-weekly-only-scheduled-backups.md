# Keep only weekly scheduled backups

## Issue

- Issue: #299
- Branch: `codex/issue-299`
- Base commit: `6f77d3e687af5efad5655e8584264681ef031cbf`

## Outcome

Production schedules only the Monday weekly backup and retains it for 30 days.
Deploy and import safety points remain available as non-scheduled operational
backups retained for 48 hours.

## Context

- Issue #297 introduced hourly and weekly tiers, but the product owner decided
  the hourly schedule is unnecessary before production timers were enabled.
- Deploy and Bible import workflows require a fresh pre-change recovery point.
- Existing hourly and daily archives must remain valid restore inputs.

## Constraints

- Keep the Monday weekly schedule and 30-day retention.
- Do not weaken deploy/import pre-change backup gates.
- Do not claim a 60-minute RPO after removing the hourly schedule.
- Production activation and archive pruning require immediate human approval.

## Non-goals

- Off-host disaster recovery.
- Encryption or key changes.
- Removing pre-change backups.

## Plan

1. [x] Replace the hourly tier with a non-scheduled operational tier and remove
       hourly systemd units.
2. [x] Change health monitoring and current recovery documentation to the
       weekly objective.
3. [x] Preserve restore and retention compatibility for legacy hourly/daily
       archives.
4. [x] Run backup rehearsal and canonical checks.
5. [ ] Merge only after required CI passes, then prepare the separately approved
       production activation.

## Progress

- 2026-08-26 JST — Started after the product owner removed the hourly schedule;
  confirmed production currently has no backup timers enabled.
- 2026-08-26 JST — Removed hourly units, added the operational pre-change tier,
  changed health monitoring to weekly freshness, and retained legacy restore
  compatibility.
- 2026-08-26 JST — Disposable rehearsal created operational and weekly
  archives, restored/reconciled weekly data, invalidated the synthetic session,
  and completed in 3 seconds.
- 2026-08-26 JST — Canonical checks passed, including 264 unit tests, 53
  component tests, type checking, linting, operational invariants, and the
  production build.

## Decisions

- 2026-08-26 — Rename pre-change backups to `operational` instead of continuing
  to call them hourly.
  - Reason: they are event-driven safety points, not scheduled recovery points.
- 2026-08-26 — Alert when no weekly archive is newer than eight days.
  - Reason: the objective is one run per seven days; one extra day permits timer
    jitter and delayed operational response without claiming an hourly RPO.

## Risks and mitigations

- Risk: removing hourly backups expands the logical loss window to one week.
  - Mitigation: record the accepted weekly recovery objective and retain
    pre-change backups for risky operations.
- Risk: legacy archives become unusable after directory renaming.
  - Mitigation: restore and pruning explicitly support legacy hourly and daily
    directories.

## Verification

- [x] `pnpm backup:config:check`
- [x] `pnpm backup:rehearse`
- [x] `pnpm check`
- [ ] Required CI: Quality / Database / E2E / Security
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, local verification, and final diff review.
- Remaining: PR, required CI, merge, and separately approved production activation.
- Blocker: none for repository implementation.
- Resume with: create the PR and wait for all required CI checks.

## Result

Pending.
