# Add typed slide bookmarks to folders

## Issue

- Issue: #420
- Branch: `codex/issue-420`
- Base: `f95cf1041e8e425c5be138314c9a47be4db29488`

## Outcome

Each slide-list row can save its owned Slide into the folder selected in the shared sidebar. Mixed Scripture/Slide favorites remain ordered, tenant-scoped, navigable and deletable.

## Contract and decisions

- Add `SlideBookmark` as an exclusive typed child of `Bookmark`, with composite church FKs to both parent and Slide. Update the deferred total-subtype constraint to require exactly one Scripture or Slide subtype.
- Derive bookmark title from the owned Slide on the server. The client sends only folder and Slide IDs.
- Deleting a Slide removes its bookmark parents and rewrites affected folder positions in the same transaction; deleting a folder/church keeps existing cascades.
- Keep one saved-content API and one sidebar implementation. No generic JSON payload or legacy import.
- Record this scope extension in ADR 0015 and the slide contract. Forward-only migration; no production operation.

## Plan

1. [x] Add schema/migration and repository/domain/HTTP contracts with tenant and deletion tests.
2. [x] Share selected-folder state with slide rows and refresh mixed sidebar content after save.
3. [x] Verify folder management, responsive UI, accessibility and E2E behavior.
4. [ ] Run canonical checks, review, PR, exact-head CI, merge and sync main.

## Verification

- `pnpm check`, `pnpm db:schema:check`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm security:check`, `git diff --check`.
- Required exact-head Quality, Database, E2E and Security CI.

## Progress

- 2026-09-01 JST: read #59/#416, governance, DB conventions, ADR 0015, slide contract, Next Link docs, current migration/repository/API/sidebar/list and tests. Created #420, isolated worktree and writer lease. No blocker.

- 2026-09-01 JST: implemented typed composite FKs, deferred exclusive subtype enforcement, server-derived title, mixed mapping, selected-folder UI wiring and transactional Slide-reference cleanup. Initial E2E exposed RESTRICT ordering during Church cascade; changed the unmerged migration to cascade the typed child from either owner while application Slide deletion removes parents first and compacts positions.
- Local PASS: `pnpm check` (453 unit, 94 component tests and build), `pnpm db:schema:check` (migration/schema and live test DB no drift), `pnpm test:integration` (133), `pnpm test:e2e` (33 Chromium, retries=0), `pnpm security:check` (no known vulnerabilities, 315 licenses), and `git diff --check`. All fixtures synthetic; developer/production DB untouched.
- Remaining: exact-head CI, merge and local main synchronization. No production migration/deploy/import is authorized or performed.
