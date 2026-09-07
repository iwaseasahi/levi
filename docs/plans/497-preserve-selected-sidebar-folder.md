# Preserve the selected sidebar folder across navigation

## Issue

- Issue: #497
- Branch: `codex/issue-497`
- Base commit: `7e18fb4967c111de744340f2fa506123fa783c56`

## Outcome

The shared Church sidebar keeps its stable folder display order while reopening
the folder most recently selected by the user after bookmark navigation or a
page reload.

## Context

- `src/app/church/use-saved-content-controller.ts` currently opens the first
  displayed folder whenever the sidebar mounts.
- `src/infrastructure/database/saved-content-repository.ts` records
  `lastUsedAt` for explicit folder and bookmark selection, while displaying
  folders in pinned/position order.
- PR #229 intentionally separated display order from recency but did not update
  the client-side initial-selection rule.
- `tests/e2e/slide-list.spec.ts` already traverses the affected Scripture and
  Slide bookmark routes but does not assert the accordion state afterward.

## Constraints

- Preserve pinned/position display order, the 20-folder limit, and tenant scope.
- Update `lastUsedAt` only for explicit folder or bookmark selection.
- Use the same restoration rule for mouse and keyboard navigation.
- Use synthetic test data only.
- Do not include the user-provided recording in repository or CI artifacts.

## Non-goals

- Redesigning the sidebar.
- Changing folder ordering, pinning, or pagination behavior.
- Addressing the separate intermittent click failure in Issue #495.

## Plan

1. [x] Add a deterministic current-folder selection rule independent of display
       order and cover it at component level.
2. [x] Extend the existing Slide/sidebar E2E scenario to assert the originating
       folder remains expanded after Scripture and Slide bookmark navigation,
       Enter activation, and reload.
3. [x] Align the saved-content architecture text with the already accepted
       stable display order and current-folder semantics.
4. [x] Run focused tests and all applicable canonical checks, then review the
       complete diff.
5. [ ] Commit, open the pull request with evidence, and verify protected CI on
       the exact head commit.

## Progress

- 2026-09-07 11:39 JST — Started from Issue #497 at base `5fa69f8`; confirmed
  the worktree is clean and acquired the writer lease.
- 2026-09-07 11:49 JST — Added the component regression before the fix; it
  failed because the first-position folder opened instead of the newer
  `lastUsedAt` folder (1 failed, 6 passed).
- 2026-09-07 11:50 JST — Implemented independent current-folder selection; the
  focused component suite passed 7/7.
- 2026-09-07 11:54 JST — Updated the cross-route E2E assertions and aligned the
  prior stable-order assertion; `pnpm test:e2e` passed 35/35 with retries zero.
- 2026-09-07 11:57 JST — The first `pnpm check` attempt stopped before tests
  because the isolated worktree had no local `DATABASE_URL`; generated the
  ignored `.env` through `pnpm local:env:prepare`.
- 2026-09-07 11:58 JST — `pnpm check` passed, including 530 unit tests, 122
  component tests, configuration checks, typecheck, lint, format, and build.
- 2026-09-07 11:58 JST — `pnpm test:integration` passed 140/140 and
  `pnpm security:check` passed with no high/critical vulnerability and 356
  approved license records.
- 2026-09-07 12:00 JST — Final `pnpm check` passed after adding the equal-time
  tie-break assertion; `git diff --check` also passed.
- 2026-09-07 12:02 JST — Rebased the unpushed commit onto current `origin/main`
  at `7e18fb4` after Issues #496 and #494 merged; no conflicts.
- 2026-09-07 12:05 JST — Repeated exact-head verification after the rebase:
  frozen install, `pnpm check`, 140 integration tests, 35 E2E tests with zero
  retries, and `pnpm security:check` all passed.

## Decisions

- 2026-09-07 — Decision: keep folder display order and current-folder selection
  as separate concerns.
  - Reason: Issue #228 requires stable pinned/position order, while bookmark and
    explicit folder selection already persist recency through `lastUsedAt`.
  - Alternatives: restoring `lastUsedAt` display sorting would regress #228;
    placing folder IDs in navigation URLs would unnecessarily expand route
    contracts.
  - ADR: update ADR 0007 to reflect the accepted stable-order amendment.

## Risks and mitigations

- Risk: timestamps may be equal.
  - Mitigation: preserve the server's deterministic displayed order as the
    tie-break and add focused unit coverage.
- Risk: a selected folder may fall outside the 20 displayed folders.
  - Mitigation: select only among the tenant-scoped folder summaries returned to
    the sidebar; fall back to the first displayed folder.

## Verification

- [x] Focused SavedContentPanel component tests — 7/7 passed
- [x] Existing saved-content integration coverage — 12/12 passed
- [x] Slide/sidebar Chromium E2E with retries disabled — full suite 35/35 passed
- [x] `pnpm format:check` — passed through `pnpm check`
- [x] `pnpm lint` — passed through `pnpm check`
- [x] `pnpm typecheck` — passed through `pnpm check`
- [x] `pnpm test` — 530 unit and 122 component tests passed
- [x] `pnpm test:integration` — 140/140 passed
- [x] `pnpm test:e2e` — 35/35 passed
- [x] `pnpm security:check` — passed
- [x] `pnpm build` — passed through `pnpm check`
- [x] `git diff --check` — passed

## Handoff or blockers

- Completed: implementation, documentation, component/integration/E2E
  verification, and canonical checks.
- Remaining: final diff review, commit, pull request, and protected CI.
- Blocker: none.
- Resume with: run final diff checks and commit the reviewed patch.

## Result

The implementation and local verification are complete. The sidebar now derives
its initial current folder from the newest displayed `lastUsedAt` without
changing pinned/position display order. Component coverage fixes recency and
equal-time behavior; E2E covers Enter and mouse navigation across Scripture and
Slide routes plus reload. Pull request and protected CI remain pending.
