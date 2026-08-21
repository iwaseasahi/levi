# Initial-release latest-Chrome E2E completion

## Issue

- Issue: #57
- Branch: `codex/issue-57`
- Base commit: `8380738`

## Outcome

Deterministic Playwright scenarios prove the complete initial-release workflow
in the repository-pinned latest Chromium: operator provisioning, forced
credential lifecycle, Church login/logout, all search languages, two-window
projection and recovery, boundary navigation, tenant denial, and reusable
folders/bookmarks.

## Constraints

- Use synthetic deterministic data only.
- Do not enable retries or timeout sleeps; wait for observable UI, network, or
  browser state.
- Disable screenshot, video, and trace for any scenario that handles a one-time
  password.
- Keep the audience as a real second page/window; do not replace the browser
  message channel with mocks.
- Use the project-pinned Chromium in CI as the latest-Chrome release contract.

## Plan

1. [x] Map every Issue #57 acceptance criterion to an existing or new E2E
       assertion and record the matrix.
2. [x] Extend provisioning and reset scenarios through temporary-password
       login, forced change, logout, and stale-session rejection without secret
       artifacts.
3. [x] Extend scripture scenarios for Japanese/English/bilingual search, real
       audience scrolling, every navigation boundary, and window recovery.
4. [x] Extend saved-content scenarios for pin/recent, folder/bookmark reorder,
       reopen, and physical deletion while retaining tenant denial checks.
5. [ ] Pass exact-commit CI before
       merge.

## Progress

- 2026-08-21 20:08 JST — Started automatically after Issue #56 merged;
  inspected all current E2E scenarios, fixtures, UI controls, and acceptance
  gaps; acquired the writer lease.
- 2026-08-21 20:12 JST — Completed the nine-scenario suite: all three search
  languages, real two-window scroll/font/blank/recovery, every navigation
  boundary, saved-content ordering/deletion, provisioning-to-first-login, and
  reset-time stale-session denial passed without retry.
- 2026-08-21 20:15 JST — Repeated the complete Chromium suite twice at 9/9,
  reviewed the passing artifact set (JUnit and HTML only), and passed format,
  lint, typecheck, 138 unit, 23 component, and production build checks.

## Decisions

- 2026-08-21 — Decision: extend the established focused scenarios instead of
  one test for the entire product.
  - Reason: one cohesive scripture flow proves state continuity while focused
    auth/admin scenarios isolate credential and session failures.
- 2026-08-21 — Decision: provisioning itself continues through first login and
  password replacement.
  - Reason: this proves that the one-time credential emitted by the operator
    workflow is actually usable and correctly gated.

## Verification

- [x] `pnpm test:e2e`
- [x] `pnpm check`
- [x] deterministic repeated local E2E run
- [ ] exact-head `Quality`, `Database`, `E2E`, `Security`

## Handoff or blockers

- Completed: acceptance inventory, current test/fixture review, plan.
- Remaining: full local quality gate and exact-commit CI verification.
- Blocker: none.
