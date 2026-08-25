# Change long-term backups to weekly Monday retention

## Issue

- Issue: #297
- Branch: `codex/issue-297`
- Base commit: `a45d5ef85b1da725d7e788e9cd53f5b29c672668`

## Outcome

Production keeps encrypted hourly backups for 48 hours and creates the
long-term encrypted backup once each Monday, retaining weekly archives for 30
days.

## Context

- `scripts/production-backup.sh` currently accepts `hourly|daily` and prunes
  daily archives after 14 days.
- `deploy/production/systemd/levi-backup-daily.timer` currently runs every day.
- `scripts/production-restore.sh` restricts restore inputs to the hourly and
  daily directories.
- Production may already contain legacy daily archives that must remain
  restorable during the transition.

## Constraints

- Keep the hourly 48-hour retention and 60-minute RPO unchanged.
- Keep encryption, reconciliation, capacity checks, and isolated restore
  behavior unchanged.
- Preserve restore compatibility for existing `daily/` archives.
- Production timer changes and archive deletion require immediate human
  approval and are not authorized by merging this repository change.

## Non-goals

- Off-host disaster recovery.
- Encryption or recovery-key changes.
- Removing legacy daily archives during repository implementation.

## Plan

1. [x] Inspect backup, restore, timer, validation, and runbook behavior.
2. [x] Add a weekly tier, Monday timer, 30-day pruning, and legacy daily restore
       compatibility.
3. [x] Exercise the weekly tier in the disposable backup/restore rehearsal.
4. [x] Update operating documentation and the production transition steps.
5. [ ] Run canonical checks and required CI, then merge.

## Progress

- 2026-08-26 JST — Started from Issue #297; confirmed the current hourly 48-hour
  and daily 14-day implementation and identified legacy restore compatibility
  as the transition boundary.
- 2026-08-26 JST — Added the weekly tier and Monday timer, retained legacy daily
  restore compatibility, and documented the approved production transition.
- 2026-08-26 JST — Disposable rehearsal created hourly and weekly encrypted
  archives, restored the weekly archive, reconciled data, and invalidated the
  synthetic session in 3 seconds.
- 2026-08-26 JST — `pnpm check` passed with synthetic worktree-only database and
  HTTPS authentication configuration; unit 264/264 and component 53/53 passed,
  and the production build completed.

## Decisions

- 2026-08-26 — Store new long-term archives under `weekly/`.
  - Reason: directory and manifest semantics should match the actual schedule.
  - Alternatives: continue writing weekly files under `daily/`; rejected because
    it leaves misleading operational state.
- 2026-08-26 — Continue accepting legacy `daily/` archives for restore.
  - Reason: changing the schedule must not invalidate an existing recovery
    point.

## Risks and mitigations

- Risk: both daily and weekly timers remain active after an in-place update.
  - Mitigation: document an explicit disable/remove/reload/enable transition and
    verify the timer list before completion.
- Risk: legacy daily archives remain forever after the timer is disabled.
  - Mitigation: age them out at the new 30-day boundary from the weekly backup
    job, with production activation called out as a backup-deletion approval.

## Verification

- [x] `pnpm backup:config:check`
- [x] `pnpm backup:rehearse`
- [x] `pnpm check`
- [ ] Required CI: Quality / Database / E2E / Security
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: current configuration and transition boundary inspected.
- Remaining: implementation, verification, PR, CI, merge, approved production
  transition.
- Blocker: none for repository implementation.
- Resume with: update backup tiers and systemd units.

## Result

Pending.
