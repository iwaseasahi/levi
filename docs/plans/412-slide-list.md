# Simplify the slide index

- Issue: #412; revises the UI portion of #385 per explicit user instruction.
- Branch: `codex/issue-412`; base: `df24ccc`.
- Read: governance, ADR 0015, slide contract/testing strategy, existing list/tests,
  version-matched Next navigation and metadata docs.

## Plan

1. [x] Set heading/browser title, remove mode/search UI, use all mode from mount.
2. [x] Add readable full-width title rows, secondary authors and clear create link.
       Keep bounded cursors, refresh/retry, stale-read guard and conditional paging.
3. [x] Adapt component/lifecycle/list E2E; preserve search/recent API assertions.
4. [x] Run checks, inspect narrow/wide synthetic screenshots and review the diff.
       Exact required CI/merge status is recorded in the PR.

## Decisions / boundaries

- Keep existing newest-created order and 20-row API; no database/API/auth changes.
- Full-row links have title-only accessible names with optional author description.
- Preserve pagination during a pending Back request so keyboard focus is retained.
- No new dependencies, production actions, sidebar changes or local DB migration.
- Backend search/recent remains available for compatibility, but not exposed here.

## Verification

- `pnpm check`: passed format, lint, typecheck, 438 unit / 92 component tests,
  configuration checks and production build.
- `pnpm test:e2e`: 32 Chromium tests passed, zero retries. Inspected synthetic
  slide-list-390.png and slide-list-1280.png; titles wrap and row links remain
  readable/focusable without horizontal overflow. Axe passed at both widths.
- Tests verify 20 + 5 rows, equal-timestamp cursor traversal and Back using hrefs
  (not displayed row numbers), title-only names, authors, empty/error/retry, stale
  responses, escaped HTML, document title and removal of search/mode controls.
- Search/recent/literal/no-match checks still run through the authenticated API;
  existing integration/domain/controller coverage remains unchanged.
- Initial typecheck found unsupported Testing Library `exact` options copied
  from Playwright usage; removed those options (string role names already match
  exactly) without weakening assertions. Final full check passed.
- Separate review: one cohesive list UI change with required tests/docs. No API,
  DB, auth, dependency or sidebar changes; no real data or secrets. Whitespace
  check passed. Numbering is display-only; cursor identity remains server-owned.
- Exact required CI head and merge status are recorded in the PR.
