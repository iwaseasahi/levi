# Rehearse Slide expansion and deletion-aware recovery

Issue #389 / parent #59, dependencies #382/#384 merged. Branch
`codex/issue-389`, base `bc27deb`; writer lease acquired before edits.
Read governance, ADR 0015, database conventions, migration evidence policy,
backup/restore scripts and testing strategy. No legacy dump or production access.

## Plan

1. [x] Document schema-before-app rollout, legacy Slide non-import and forward rollback.
2. [x] Add compatible backup reconciliation for Slide ownership/content/revision;
       retain old archive restore support and revoke restored sessions.
3. [x] Rehearse backup before synthetic Slide/Church deletion, restore into an
       isolated DB, reapply scoped deletions, compare unaffected data and hashes.
4. [ ] Run db:check, integration, backup:rehearse, check and security; inspect
       diff, PR, exact-head CI and merge.

## Decisions / constraints

- #387/#400 CI is running independently; #389 depends only on already merged
  schema and CRUD. Work remains in its own worktree/lease.
- Hard deletion is not immediate backup purge. Promotion requires a reviewed
  deletion reconciliation; cannot infer historical deletions from a backup alone.
- No new schema, import target, data history, provider or production operation.
- Preserve v1 backup compatibility; version any stronger reconciliation contract.
- #390 alone marks final Slide parity verified after all children complete.

## Progress

- Expanded synthetic rehearsal passed in 6 seconds: populated Bible/Folder/Bookmark
  values unchanged by expansion, v2 Slide fingerprint matched, reviewed deletion
  replay preserved other tenant, church/admin sessions cleared, bad fingerprint
  rejected, v1 restored. First fixture attempt exposed a deferred bookmark subtype
  constraint; corrected the fixture transaction, without altering DB constraints.
- Review found restoration cleared only church sessions; shared SQL now invalidates
  and checks administrator sessions too (including promotion). Pre-admin archives
  remain compatible through table-existence checks. No production action executed.
- `pnpm db:check`: migrations/drift/seed passed. `pnpm check`: passed on initial
  branch. Synced merged projection/fixture main before final full verification.
- Separate review covered archived-format compatibility, all-field fingerprints,
  physical deletion ambiguity, scoped synthetic cleanup and unchanged permissions.
