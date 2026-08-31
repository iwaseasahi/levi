# Show slides below sidebar folders

## Issue

- Issue: #406 (follow-up to #59)
- Branch: `codex/issue-406`
- Base: `217be428390c6f314cf7eb585724bd6462722ffe`

## Outcome and constraints

Display church-owned slide titles under scripture sidebar folders, with direct
create/detail links and access to the existing full search. Remove the settings
menu entry. Reuse the existing list API and cursor handling; do not change DB,
authorization, projection or apply outstanding development migrations.

## Plan

1. [x] Inspect governance, ADR 0015, slide contract, Next navigation docs and UI.
2. [x] Add compact all-list variant, sidebar integration and remove settings link.
3. [x] Verify loading/empty/error/retry/paging, focus, narrow/wide UI and navigation.
4. [ ] Run canonical checks, review final diff, submit and merge with required CI.

## Decisions

- Reuse SlideList rather than duplicate request/race/paging logic. Sidebar starts
  in all mode (20 titles/page), and full search remains at /slides.
- Background sidebar failures announce an alert without moving keyboard focus.
- Keep the existing scrollable 210px sidebar; wrap long titles and controls.

## Progress and verification

- 2026-08-31: Implemented sidebar variant. `pnpm check` passed: format, lint,
  typecheck, 438 unit / 93 component tests, configuration checks and build.
- `pnpm test:e2e` passed 32 tests, zero retries, including sidebar create/detail
  navigation, keyboard Enter, 390px/1280px placement and axe checks. Generated
  `slide-sidebar-390.png` / `slide-sidebar-1280.png` were visually inspected.
  Existing scripture horizontal scrolling is unchanged; sidebar fits both widths.
- `pnpm test:integration` passed 132 tests against disposable local levi_test.
- `pnpm security:check` passed: no known vulnerabilities, 315 license records.
- Review: no API, authentication, DB, dependency or projection changes. Cursor
  requests remain bounded/no-store and stale responses remain ignored. Settings
  retains password/logout. Scope and whitespace checked; no secrets or real data.
- Initial component run exposed an ambiguous global status selector after adding
  independent sidebar loading feedback. Scoped the assertion to catalog text and
  retained its status-role and visually-hidden assertions; full suite then passed.
- Initial offline install failed because lifecycle PATH could not resolve Node;
  rerunning with the existing pinned-runtime wrapper.

## Risks

Missing local Slide migration remains a separate known environment issue. This
change does not reset/migrate the user's development DB. Tests use synthetic data.

## User correction

PR #407 merged at af09fae. The user then clarified that only a
“スライドの一覧” link below “フォルダの一覧” was intended. Issue #408 supersedes
this plan's embedded-list design and removes its extra requests and controls.
