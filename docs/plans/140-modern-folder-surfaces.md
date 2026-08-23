# Add a modern folder index and management surfaces

## Issue

- Issue: #140
- Branch: `codex/issue-140`
- Base commit: `6a6d51767b894cc289a6a69793085075e2dc61f0`

## Outcome

The scripture sidebar links to a same-tab `/folders` index, and every
folder-related surface uses a consistent modern dark presentation without
changing folder, bookmark, or projection behavior.

## Context

- `SavedContentPanel` currently links directly to the selected folder editor.
- Folder and bookmark editing use dense legacy-style forms and tables.
- The existing tenant-scoped `/api/saved-content` list response is sufficient
  for an index; individual editing remains under `/folders/[folderId]/edit`.
- The scripture table retains its Ginmaku projection workflow; this issue changes
  only its folder sidebar and the dedicated management routes.

## Constraints

- Preserve the black site theme, latest-Chrome scope, tenant isolation, physical
  deletion, drag ordering, keyboard fallback, and audience-tab behavior.
- Preserve the existing API and database schema.
- Keep `/scripture`'s 230px content offset so the Bible table does not move.
- Use framework-native links and routes without adding a design dependency.

## Non-goals

- Inline editing or ordering on the folder index.
- Redesigning Bible search or the audience projection screen.
- Adding analytics, dates, or bookmark counts to the persisted folder model.

## Plan

1. [x] Add the protected `/folders` route and a tenant-scoped folder index with
       loading, empty, error, and populated states.
2. [x] Change the scripture action to `フォルダの一覧` and route it to `/folders`.
3. [x] Modernize sidebar folder cards, creation controls, and feedback while
       preserving opening, saving, drag, and keyboard behavior.
4. [x] Modernize folder and bookmark editors with responsive cards, clear
       actions, status badges, and accessible focus states.
5. [x] Add component and latest-Chrome E2E coverage, accessibility checks, and
       normal/narrow rendered inspection.
6. [ ] Run canonical verification and merge only after exact-head CI succeeds.

## Progress

- 2026-08-23 JST — Expanded Issue #140 after the product direction changed from
  a list-only request to a cohesive modern redesign of folder-related surfaces.
- 2026-08-23 JST — Inspected the list API, protected route pattern, sidebar,
  individual editors, CSS constraints, tests, and Next.js route/link guidance.
- 2026-08-23 JST — Added `/folders`, same-tab navigation, responsive folder
  cards, modern editors, and loading/empty/error/success states.
- 2026-08-23 JST — Added component coverage and exercised the complete Chromium
  flow, color contrast, and 390px overflow check. The first run exposed a stale
  form-state submission in bookmark editing; submission now reads the current
  form value and the rerun passes.

## Decisions

- 2026-08-23 — Use `/folders` as the canonical index and keep individual edits
  at `/folders/:folderId/edit`.
  - Reason: the resource hierarchy is direct, bookmark edit URLs remain stable,
    and no redirect or API change is needed.
- 2026-08-23 — Modernize with repository CSS rather than a UI dependency.
  - Reason: existing tokens cover the dark palette and the scope does not need
    a reusable third-party component system.
- 2026-08-23 — Keep the scripture workspace's fixed 230px boundary.
  - Reason: the user requested a folder redesign, not movement or resizing of
    the established Bible search controls.

## Risks and mitigations

- Risk: folder CSS accidentally changes the projection/search layout.
  - Mitigation: scope sidebar selectors and preserve the existing workspace
    positioning; exercise the complete scripture E2E flow.
- Risk: a new index leaks another church's folders.
  - Mitigation: use only the authenticated tenant-scoped endpoint and retain its
    integration coverage.
- Risk: responsive styles hide destructive or recovery actions.
  - Mitigation: inspect wide and narrow states and assert named controls.

## Verification

- [x] `pnpm check`
- [x] `pnpm db:check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, component coverage, rendered inspection, and E2E.
- Remaining: PR, exact-head CI, and merge.
- Blocker: none.
- Resume with: commit, open the PR, and wait for exact-head CI.

## Result

Pending implementation and merge.
