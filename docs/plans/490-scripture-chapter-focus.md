# Preserve multi-digit scripture chapter input

## Issue

- Issue: #490
- Branch: `codex/issue-490`
- Base commit: `95c08518a4882e8a200b97e8ec6d1b52eaff5fb0`

## Outcome

Church users can type two- and three-digit chapter numbers continuously while
scripture catalog candidates refresh, without losing focus or accepting a stale
catalog response.

## Context

- `src/app/church/use-scripture-catalog.ts` starts a catalog request for every
  non-empty chapter edit and already discards stale responses by sequence.
- `src/app/church/scripture-search-view.tsx` disables both the enclosing
  fieldset and chapter input while a catalog request is loading, which removes
  focus after the first digit.
- The delayed-catalog E2E coverage in
  `tests/e2e/scripture-search-validation.spec.ts` currently fills only one
  digit, so it does not exercise focus retention or successive requests.
- `docs/product/scripture-search-contract.md` requires usable keyboard focus and
  latest-Chrome behavior.

## Constraints

- Preserve catalog loading announcements, disabled submission while candidates
  are unsettled, full-width digit normalization, and stale-response sequencing.
- Keep the Ginmaku-compatible layout and all database/API contracts unchanged.
- Follow `docs/governance/autonomy.md`, `docs/testing.md`, and the repository
  Definition of Done.

## Non-goals

- Debouncing or redesigning scripture catalog requests.
- Changing scripture ranges, APIs, database schema, or page styling.

## Plan

1. [x] Add component coverage that delays successive chapter catalog responses
       and proves multi-digit input, focus retention, and latest-response use.
2. [x] Separate editable chapter state from loading-dependent operation guards
       without weakening error or submission controls.
3. [x] Extend the delayed Chromium E2E scenario to type multiple digits and
       assert focus while loading.
4. [x] Run focused and canonical verification, review the diff, and prepare the
       Issue-linked pull request.

## Progress

- 2026-09-06 17:24 JST — Read Issue #490, governance, execution protocol,
  testing guidance, scripture product contracts, version-matched Next.js client
  component documentation, current implementation, tests, and relevant history.
  Created the dedicated branch/worktree and acquired the writer lease.
- 2026-09-06 17:26 JST — Added a gated component regression test and proved it
  failed before the production change: typing `100` resulted in `1` because the
  first request disabled the focused input. Removed loading-based disabling from
  the fieldset and chapter editor; the focused component file then passed 19/19.
- 2026-09-06 17:29 JST — Extended the delayed latest-Chromium scenario to hold
  the `1`, `10`, and `100` requests while asserting the normalized value and
  focus. Full E2E passed 35/35.
- 2026-09-06 17:32 JST — Canonical verification passed: `pnpm check` (530 unit,
  121 component, lint, typecheck, configuration checks, and production build),
  `pnpm test:integration` (140 tests), `pnpm security:check` (no high/critical
  vulnerability; 356 approved license records), and `git diff --check`.
- 2026-09-06 17:47 JST — Required Quality, Database, E2E, and Security jobs all
  passed on implementation commit `59e13a6` in PR #491.

## Decisions

- 2026-09-06 — Decision: keep immediate catalog requests and the existing
  sequence guard, but do not disable the chapter editor during its request.
  - Reason: request concurrency is already made deterministic; disabling the
    controlled input causes the reported focus loss and prevents completing the
    value.
  - Alternatives: debounce was rejected as unnecessary scope expansion.
  - ADR: none; this restores the existing input contract.

## Risks and mitigations

- Risk: allowing edits during loading could expose dependent controls backed by
  stale verses.
  - Mitigation: continue disabling Open and chapter-dependent verse fields until
    the latest catalog succeeds, while the sequence guard rejects stale results.
- Risk: a fast mocked response can hide the browser focus defect.
  - Mitigation: gate catalog responses explicitly in component and Chromium E2E
    coverage and assert `document.activeElement` behavior.

## Verification

- [x] `pnpm test:component` — 121 passed
- [x] `pnpm test:e2e` — 35 passed on latest Chromium
- [x] `pnpm check` — passed; 530 unit and 121 component tests
- [x] `pnpm test:integration` — 140 passed
- [x] `pnpm security:check` — passed
- [x] `git diff --check` — passed
- [x] Acceptance criteria verified by required CI on implementation commit
      `59e13a6`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, regression coverage, local verification, and
  self-review.
- Remaining: commit this final evidence-only plan update and confirm required CI
  remains successful on the resulting head.
- Blocker: none.
- Resume with: commit the reviewed patch and open the Issue-linked pull request.

## Result

The chapter editor remains enabled while catalog candidates load. Component and
latest-Chromium coverage prove continuous three-digit input, focus retention,
and rejection of stale catalog responses. Required CI passed on the reviewed
implementation commit; the final evidence-only plan update needs exact-head CI.
