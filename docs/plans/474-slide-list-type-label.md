# Show Slide type in the Slide list

## Issue

- Issue: #474
- Branch: `codex/issue-474`
- Base commit: `4874ddddac2c9d0496a7b83fc33790fd58f41f55`

## Outcome

Each Slide title in the list starts with a readable `テキスト` or `画像` label,
so operators can distinguish the two surfaces before opening the Slide.

## Context

- The persisted Slide already has a tenant-scoped `content_type` enum.
- The list projection currently omits that field even though detail responses
  expose the normalized `text | image` value.
- The list link currently derives its accessible name from the title alone.

## Constraints

- Return only normalized type metadata; do not add body, image metadata, or image
  bytes to the list response.
- Preserve ordering, cursor pagination, tenant scope, favorite, and delete behavior.
- Keep the type visible as text and included in the link's accessible name.
- Avoid schema, dependency, projection, or editor changes.

## Non-goals

- Filtering, sorting, searching, or using icon-only type indicators.
- Production deployment.

## Plan

1. [x] Extend the list domain and repository projection with normalized
       `contentType` values and cover the database boundary.
2. [x] Render compact type labels before titles with accessible and responsive
       styling.
3. [x] Update component/E2E acceptance coverage and contract documentation, then
       run all applicable checks.

## Progress

- 2026-09-04 — Created and read Issue #474; inspected the list contract,
  repository, UI, tests, ADR 0016, and version-matched Next.js client-component
  guidance.
- 2026-09-04 — Added normalized list metadata and visible Japanese type labels.
  Component tests pass all 113 cases and integration passes all 137 cases.
- 2026-09-04 — Updated affected list-link accessibility locators after the first
  E2E run exposed the intended accessible-name change. The final 35-test Chromium
  run passed with zero retries.
- 2026-09-04 — Visually reviewed generated 1280px and 390px screenshots; both
  type labels remain visible, long titles wrap, and no horizontal overflow occurs.

## Decisions

- 2026-09-04 — Decision: normalize Prisma's `TEXT | IMAGE` values at the list
  repository boundary and expose `text | image` in the domain result.
  - Reason: this matches the existing public Slide contract without leaking a
    persistence enum into the UI.

## Risks and mitigations

- Risk: the badge crowds or overflows long titles on narrow screens.
  - Mitigation: keep the badge non-growing and allow the title text to wrap.
- Risk: a visual-only marker is unavailable to assistive technology.
  - Mitigation: use visible text within the link's labelled content.

## Verification

- [x] Focused unit/component/integration tests
- [x] `pnpm test:e2e` — 35 Chromium tests passed
- [x] `pnpm check` — 77 unit files / 488 tests, 25 component files / 113 tests,
      configuration checks, and production build passed
- [x] `pnpm test:integration` — 26 files / 137 tests passed
- [x] `pnpm security:check` — no high or critical finding; 314 production license
      records approved
- [x] `git diff --check`
- [x] 1280px and 390px screenshots visually reviewed

## Handoff or blockers

- Completed: Issue intake, branch isolation, implementation, documentation, and
  local verification.
- Remaining: commit, PR, and exact-head CI.
- Blocker: none.
- Resume with: commit the scoped files and open the pull request.

## Result

The list response now exposes normalized Slide type metadata, and each title is
preceded by a compact, readable `テキスト` or `画像` label. The label participates
in the link's accessible name and remains usable at narrow and wide widths.
