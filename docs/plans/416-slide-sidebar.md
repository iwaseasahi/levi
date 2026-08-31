# Share the Scripture sidebar with the slide index

## Issue

- Issue: #416 (follow-up to #59 and #414)
- Branch: `codex/issue-416`
- Base: `fbddcf649230b35420de679b351d850209b6b093`

## Outcome and scope

Reuse `SavedContentPanel` on `/slides`, left of the existing list on desktop and
above it on narrow screens. Preserve folder actions and restore saved Scripture
conditions when a bookmark is selected. Do not change editor/detail/audience
layouts, APIs, authorization, dependencies, or database schema/data.

## Context and decisions

- The current `(manage)` layout constrains all children to `.slide-page` and
  styles descendant inputs/buttons. Move only its index page outside that route
  group to avoid leaking slide form styles into the existing sidebar.
- Reuse the existing panel and its authorized API operations. Pass validated
  Scripture coordinates to `/scripture` when selecting a bookmark; never put
  folder names, bookmark titles, slide contents, or auth state into the URL.
- Seed the catalog's initial selection rather than racing a second restore
  effect against the default catalog fetch. Invalid query input uses the normal
  blank search. Existing Scripture-page bookmark selection remains in place.
- Existing ADR 0015 and product slide contract remain unchanged. No migration,
  deployment, legacy import, real data, or developer DB operations are involved.

## Plan

1. [x] Compose the slide index with the existing sidebar and responsive styles.
2. [x] Preserve bookmark navigation and verify query validation/initial loading.
3. [x] Run canonical checks and browser acceptance; review the diff.
4. [ ] Open PR, verify exact-head required CI, merge and synchronize local main.

## Verification

- `pnpm check`: format, lint, typecheck, unit/component suites, build.
- `pnpm test:e2e`: synthetic disposable fixtures only; layout, folder creation,
  bookmark navigation, omitted end verse, keyboard, mobile and axe checks.
- `git diff --check` and final scope/security review.
- Exact-head Quality, Database, E2E and Security results recorded in PR.

## Progress

- 2026-08-31 JST: inspected existing sidebar/controller, slide route group,
  catalog initialization, Next page/searchParams docs and test suites. Created
  dedicated worktree and acquired writer lease. No blockers.

- 2026-08-31 JST: implemented index-only composition, shared navigation, validated
  Scripture links and initial catalog selection. Initial typecheck caught route
  literal inference and mock-call indexing; both corrected without type casts or
  weakened checks. `pnpm check` then passed: 451 unit, 93 component tests and
  production build. `pnpm test:e2e` passed all 33 Chromium tests, retries=0.
- Reviewed 390px/1280px synthetic screenshots: sidebar stacks on mobile and sits
  left on desktop; row focus and titles remain readable, no horizontal overflow.
  Axe and bookmark/folder navigation checks passed. Final diff review found no
  API/schema/auth/projection changes, secrets, or unrelated changes.
- Remaining: exact-head required CI, merge, and local main synchronization.
  No production or developer database operation was performed. CI and merge
  evidence will be recorded on the linked PR rather than rewriting this plan.
