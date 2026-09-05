# Make the scripture projection font scale visible and configurable

## Issue

- Issue: #478
- Branch: `codex/issue-478`
- Base commit: `779394e10df1661087d380081d0ca696386544b1`

## Outcome

The scripture search screen shows the active projection font scale. Its settings
menu links to a dedicated default-settings screen, where a browser-local default
can be changed for each newly opened scripture audience. Slide projection
remains unchanged.

## Context

- `src/app/church/scripture-search-view.tsx` renders the projection controls but
  currently receives only audience readiness.
- `src/app/projection/use-projection-audience.ts` owns the transient audience
  font scale and currently initializes every content kind at `1`.
- `src/app/church/scripture-settings-menu.tsx` currently edits the preference
  inline, but user feedback requires it to link to a dedicated screen instead.
- A protected `/settings` route is consistent with the existing standalone
  account-setting routes and keeps the search workspace focused on projection.
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

1. [x] Replace the inline selector with a `デフォルト設定` navigation item and
       add the protected dedicated settings screen.
2. [x] Move preference editing and persistence coverage to the dedicated screen
       while preserving scripture search and audience behavior.
3. [x] Update the E2E scenario and product contract for the navigation flow.
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
  acknowledged font control updates.
- 2026-09-05 21:17 JST — `pnpm check` passed, including formatting, lint,
  typecheck, 498 unit tests, 115 component tests, configuration safety checks,
  and the production build. `git diff --check` passed and the final diff was
  reviewed for scope, storage data, slide isolation, and generated noise.
- 2026-09-05 21:21 JST — Remote Quality, Database, and Security passed. Remote
  E2E showed that rendered pixel size need not grow from 140% because automatic
  fitting can compensate at that size. Retained the saved/open 140% assertion,
  then returned the active audience to the established 100% baseline before the
  existing pixel-growth and small-viewport fit checks.
- 2026-09-05 21:23 JST — The adjusted full E2E passed locally: 35 tests. This
  preserves the original fit test semantics while still verifying the saved
  default and acknowledged percentage behavior before the reset.
- 2026-09-05 21:44 JST — Reopened Issue #478 after user feedback clarified that
  the settings menu must link to a dedicated default-settings screen instead of
  containing the font-size input directly. Updated the Issue acceptance criteria
  and created a fresh worktree from merged commit `779394e`.
- 2026-09-05 21:49 JST — Added protected `/settings`, moved the selector there,
  and replaced the inline menu control with a navigation link. Evidence:
  `pnpm test` passed (498 unit, 118 component), `pnpm lint` passed, `pnpm
typecheck` passed, and the full `pnpm test:e2e` suite passed (35 tests).
- 2026-09-05 21:51 JST — Added dedicated-screen axe and 390px viewport checks.
  The changed scripture E2E passed, while an unrelated parallel Slide-list case
  missed `Synthetic 23`; 34/35 passed. Retrying the unchanged suite to classify
  the isolated failure without weakening its assertion.
- 2026-09-05 21:53 JST — A second full-suite retry again passed the changed
  scripture scenario and failed a different pre-existing Slide sidebar timing
  assertion (34/35). The changed scripture scenario then passed alone (1/1),
  including navigation, persistence, axe, narrow viewport, and projection.
- 2026-09-05 21:56 JST — `mise run check` passed: formatting, lint, typecheck,
  498 unit tests, 118 component tests, configuration safety checks, and the
  production build. `git diff --check` passed. Reviewed the final diff for scope,
  browser-storage isolation, route protection, responsive behavior, secrets,
  migrations, and generated noise.
- 2026-09-05 22:01 JST — Required Quality, Database, E2E, and Security jobs all
  passed on implementation commit `40b84ef` in PR #481. The independent E2E job
  passed the complete 35-test suite.

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
- 2026-09-05 — Decision: use protected route `/settings` with heading
  `デフォルト設定` and an immediate-save selector.
  - Reason: the user explicitly requested a navigation item and separate
    settings screen; immediate persistence preserves the established behavior
    and avoids a misleading save transaction for browser-local state.
  - Alternatives: an inline menu control contradicts the clarified requirement;
    a modal is not a screen transition.
  - ADR: Not required; this is a reversible presentation-flow change.

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
- [x] `pnpm test:component` — 118 passed
- [x] changed `pnpm exec playwright test` scenario — 1 passed; required CI E2E
      suite — 35 passed
- [x] `mise run check` — passed, including format, lint, typecheck, tests,
      configuration checks, and production build
- [x] `git diff --check` — passed
- [x] Acceptance criteria verified and final diff reviewed

## Handoff or blockers

- Completed: dedicated settings-screen correction, regression coverage,
  documentation, local verification, PR #481, and required CI on the
  implementation commit.
- Remaining: pass required CI on the final plan-only commit and merge.
- Blocker: none.
- Resume with: push the final plan evidence, wait for required CI, and merge.

## Result

PR #481 implements the dedicated settings-screen correction. The menu now links
to protected `/settings`, which persists the scripture default; existing search
percentage and scripture-only audience initialization remain intact. Local and
required CI verification passed on the implementation commit; final merge awaits
CI on this evidence-only update.
