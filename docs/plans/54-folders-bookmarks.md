# Church folders and scripture bookmarks

## Issue

- Issue: #54
- Branch: `codex/issue-54`
- Base commit: `ffb78e1`

## Outcome

An authorized church user can organize typed scripture searches in tenant-owned
folders, pin/recently use/reorder/reopen them, and physically delete bookmarks
or folders without affecting Bible masters or another church.

## Constraints

- Implement ADR 0007 and the data-model dictionary exactly, including composite
  ownership/end-point FKs and deferred total-subtype/position constraints.
- Every application and repository operation receives the server-derived
  `churchId`; UUID possession never grants access.
- Create/delete/reorder locks the owner, defers position uniqueness, validates a
  complete current ID set, and compacts to contiguous zero-based positions.
- `lastUsedAt` changes only on explicit folder selection or bookmark reopen.
- Persist typed canonical fields, never route/controller JSON.

## Plan

1. [x] Add Folder, Bookmark, and ScriptureBookmark schema, raw constraints,
       indexes, deferred triggers, and database integrity tests.
2. [ ] Implement tenant-scoped repositories/use cases for list/create/rename,
       pin/recent, save/reopen, reorder, and physical deletion.
3. [ ] Add authenticated strict APIs with denied cross-tenant cases at route,
       use-case, and repository boundaries.
4. [ ] Add accessible folder/bookmark UI to scripture search with complete
       loading/empty/error/success/disabled/focus/confirmation behavior.
5. [ ] Add latest-Chrome create/pin/recent/reorder/reopen/delete E2E, update
       parity/docs, pass exact-commit CI, and merge.

## Progress

- 2026-08-21 19:08 JST — Started automatically after merged Issue #53, read the
  accepted ADR/dictionary/product contract, and acquired the writer lease.
- 2026-08-21 19:12 JST — Added the saved-content schema and raw PostgreSQL
  contract. All 64 integration tests pass, including deferred uniqueness,
  required subtype, cross-tenant ownership, endpoint restriction, and cascade
  scope.

## Verification

- [x] raw PostgreSQL constraints and cascade/restrict scope
- [ ] stale/cross-tenant/concurrent transaction integration
- [ ] API unit and component accessibility states
- [ ] latest-Chrome complete folder/bookmark flow
- [ ] repository gates and exact-commit GitHub CI

## Handoff or blockers

- Blocker: none.
- Resume with: commit the database foundation, open a Draft PR, then implement
  tenant-scoped repositories and use cases.
