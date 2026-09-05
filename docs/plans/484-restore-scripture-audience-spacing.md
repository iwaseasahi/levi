# Restore scripture audience spacing and heading inset

## Issue

- Issue: #484
- Branch: `codex/issue-484`
- Base commit: `b66db3e7c3dcccca71be3f80150072ae4cbfa637`

## Outcome

The expanded scripture audience keeps the larger measured body region while
restoring the legacy visual separation between Japanese and English and the
legacy right inset for the scripture heading.

## Context

- `src/app/styles/audience.css` currently uses a viewport-clamped fixed grid gap
  and a full-width right-aligned heading after Issue #482.
- The supplied pre-change screenshot is visual reference only. It shows roughly
  one body-text em between languages and a heading ending about 5% from the
  viewport's right edge.
- `tests/e2e/scripture-projection-navigation.spec.ts` already verifies the
  expanded measured region and fit behavior at desktop and compact viewports.
- `docs/product/projection-window-protocol.md` defines the audience layout and
  fitting contract.

## Constraints

- Preserve the 80px body base, measured body region, 60–220% controls, and
  automatic no-overflow fit introduced by Issue #482.
- Preserve heading, verse number, language order, colors, outline, black
  background, loading/error/blank states, and slide projection behavior.
- Follow `docs/governance/autonomy.md`; production deployment is outside this
  Issue.

## Non-goals

- Adding user-configurable paragraph spacing or heading position.
- Changing scripture content, typography, colors, or slide projection layout.

## Plan

1. [x] Express the Japanese/English gap in body-text em units and restore the
       heading's legacy right inset without shrinking the measured body region.
2. [x] Extend E2E layout assertions for the language gap, heading inset, and
       continued fit at desktop and compact viewports.
3. [x] Update the projection layout contract and run the canonical checks.
4. [ ] Open a PR, verify required CI on the exact head, merge, and close #484.

## Progress

- 2026-09-05 22:43 JST — Started from `main` at the base commit; reviewed #484,
  related #482, governance, testing guidance, current CSS, E2E coverage, and the
  pre-change screenshot.
- 2026-09-05 22:50 JST — Restored a one-em grid gap and exact 5vw heading text
  endpoint while retaining the measured body grid; E2E 35/35 passed.
- 2026-09-05 22:51 JST — Canonical and focused checks passed: unit 498,
  component 118, integration 137, E2E 35, build, configuration, security, and
  whitespace checks.

## Decisions

- 2026-09-05 — Decision: use a `1em` grid row gap while keeping paragraph
  margins at zero.
  - Reason: it recreates the legacy separation between adjacent paragraphs but
    does not restore the legacy outer margins that wasted the expanded region.
  - Alternatives: fixed pixels would not follow the selected/fitted body size;
    restoring paragraph margins would reduce the usable body region.
- 2026-09-05 — Decision: keep the heading in the grid row and subtract the
  screen's existing 10px right padding from a 5vw inset.
  - Reason: right-aligned text then ends at the legacy exact 5% viewport inset
    while preserving heading/body row separation and the expanded body width.

## Risks and mitigations

- Risk: the larger language gap could cause long content to overflow.
  - Mitigation: the gap scales with the fitted font and existing desktop,
    compact, long-line, and 220% E2E scenarios must continue to fit.
- Risk: moving the heading could overlap or reduce the body region.
  - Mitigation: retain the explicit heading grid row and assert heading/body
    separation and the right inset in E2E.

## Verification

- [x] `mise run check`
- [x] `git diff --check`
- [x] `mise exec -- pnpm test:integration`
- [x] `mise exec -- pnpm test:e2e`
- [x] `mise exec -- pnpm security:check`
- [x] E2E asserts a one-em language gap and 5% heading inset.
- [x] Existing desktop, compact, long-line, and 220% audience fit assertions pass.
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults.

## Handoff or blockers

- Completed: implementation, contract, regression coverage, and local checks.
- Remaining: commit, PR, required CI, merge, and Issue closure.
- Blocker: none.
- Resume with: review and commit the scoped diff, then open the PR.

## Result

Pending.
