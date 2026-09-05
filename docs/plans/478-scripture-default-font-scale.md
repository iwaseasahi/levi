# Make the scripture projection font scale visible and configurable

## Issue

- Issue: #478
- Branch: `codex/issue-478`
- Base commit: `b0f7234261c8d865b5d46390b258e2152793560b`

## Outcome

The scripture search screen shows the active projection font scale, and the
settings menu persists a browser-local default that each newly opened scripture
audience uses. Slide projection remains unchanged.

## Context

- `src/app/church/scripture-search-view.tsx` renders the projection controls but
  currently receives only audience readiness.
- `src/app/projection/use-projection-audience.ts` owns the transient audience
  font scale and currently initializes every content kind at `1`.
- `src/app/church/scripture-settings-menu.tsx` is the existing browser-side
  settings surface.
- `docs/product/scripture-search-contract.md` and
  `docs/product/projection-window-protocol.md` currently specify a 60–220% range
  and reset-on-reload behavior.

## Constraints

- Preserve the existing 60–220% bounds, 10% step, transport schema,
  authorization checks, and fail-closed behavior.
- Persist only the numeric scripture preference in browser storage; do not
  persist scripture content or identity data.
- Do not change slide projection defaults.
- Follow the repository governance and Definition of Done.

## Non-goals

- Server-, Church-, or account-level preference synchronization.
- Applying a changed default to an already open audience.
- Changing font scale bounds or increments.

## Plan

1. [x] Add a validated browser-local scripture font-scale preference boundary.
2. [x] Connect the settings UI, search percentage display, and scripture
       audience initialization without changing the slide adapter.
3. [x] Add component and E2E regression coverage and update product contracts.
4. [x] Run relevant and canonical verification, then review the final diff.

## Progress

- 2026-09-05 21:05 JST — Created Issue #478, branch
  `codex/issue-478`, and acquired the writer lease.
- 2026-09-05 21:05 JST — Inspected governance, testing guidance, version-matched
  Next.js client-component documentation, product contracts, and current
  projection/search implementation.
- 2026-09-05 21:12 JST — Completed the validated local preference, settings
  selector, current percentage display, scripture-only audience initialization,
  product documentation, and regression tests. Evidence: `pnpm lint`,
  `pnpm typecheck`, `pnpm test:unit` (498 passed), and `pnpm test:component`
  (115 passed).
- 2026-09-05 21:14 JST — The first full E2E run exposed two stale menu-role
  locators after the settings surface became a dialog and one font-fit assertion
  whose old 100% premise had been changed. Updated the locators and restored the
  fit scenario to 100% after verifying the saved 140% default.
- 2026-09-05 21:15 JST — A second full E2E run verified the new behavior and 35
  tests passed; one unrelated Slide sidebar toggle assertion failed under the
  extra test's changed parallel schedule. Folded the new assertion into the
  existing scripture scenario to preserve the suite topology.
- 2026-09-05 21:16 JST — Full E2E passed: 35 tests. The scenario verifies 100%
  fallback, selecting and retaining 140% across reload, opening at 140%, and
  acknowledged 150%/140% control updates.
- 2026-09-05 21:17 JST — `pnpm check` passed, including formatting, lint,
  typecheck, 498 unit tests, 115 component tests, configuration safety checks,
  and the production build. `git diff --check` passed and the final diff was
  reviewed for scope, storage data, slide isolation, and generated noise.

## Decisions

- 2026-09-05 — Decision: store the default as a validated browser-local numeric
  preference and read it only for scripture audiences.
  - Reason: Issue #478 explicitly scopes persistence to the same browser and
    excludes server/account synchronization; same-origin tabs can share the
    preference without expanding the projection transport contract.
  - Alternatives: a database setting would add unrequested cross-session scope;
    a URL parameter would weaken the location-only audience URL contract.
  - ADR: Not required; this is a reversible UI preference within the accepted
    projection architecture.

## Risks and mitigations

- Risk: malformed or unavailable browser storage could prevent projection.
  - Mitigation: strict range/step validation and exception-safe 100% fallback.
- Risk: changing shared audience initialization could affect Slides.
  - Mitigation: keep the shared hook default at 100% and pass the preference only
    from the scripture adapter, with regression coverage.
- Risk: server/client rendering could disagree on browser-local state.
  - Mitigation: load the search-screen preference after hydration; the audience
    loading surface has no scale-dependent markup before client data is ready.

## Verification

- [x] `pnpm test:unit` — 498 passed
- [x] `pnpm test:component` — 115 passed
- [x] `pnpm test:e2e` — 35 passed
- [x] `pnpm check` — passed, including format, lint, typecheck, tests,
      configuration checks, and production build
- [x] `git diff --check` — passed
- [x] Acceptance criteria verified and final diff reviewed

## Handoff or blockers

- Completed: implementation, tests, documentation, and local verification.
- Remaining: commit, pull request, and required CI review.
- Blocker: none.
- Resume with: commit the reviewed patch and open the pull request.

## Result

Issue #478 is implemented locally. The scripture search panel displays the saved
or acknowledged percentage, the settings dialog persists a validated 60–220%
default, and new scripture audiences start from it while Slides remain at 100%.
All local verification listed above passes; merge and production release remain
outside this plan result until pull-request review and required CI complete.
