# Unify Levi screens with the modern scripture-search visual language

## Issue

- Issue: #148
- Branch: `codex/issue-148`
- Base commit: `36ec86ad82198725e3fca20e47cedc43a98fe84f`

## Outcome

Every application screen except the fixed congregation projection display uses
the scripture-search screen's black surfaces, white text, gold accent, compact
controls, and clearly distinguishable interaction states.

## Context

- `src/app/styles.css` contains the global, authentication, administration,
  scripture-search, folder-management, and audience styles.
- `/scripture` and the folder-management screens already use the intended gold
  `#d2a568` and restrained dark surfaces, while home, authentication, and
  administration still use older colors, radii, borders, and control states.
- `tests/e2e/walking-skeleton.spec.ts`,
  `tests/e2e/operator-provisioning.spec.ts`, and
  `tests/e2e/scripture-search.spec.ts` provide browser and accessibility
  coverage for the affected routes.

## Constraints

- Preserve application behavior, authentication, authorization, database
  contracts, and route structure.
- Preserve the approved Ginmaku-compatible `/scripture/audience` DOM, colors,
  typography, and navigation behavior.
- Keep the home page limited to its title and one context-aware action.
- Use existing CSS and dependencies; no new production dependency is needed.
- Merge only after the exact PR head passes `Quality`, `Database`, `E2E`, and
  `Security`.

## Non-goals

- Redesigning the congregation projection display.
- Changing APIs, database schema, authentication behavior, or content.
- Adding new application features or routes.

## Plan

1. [x] Normalize the shared dark design tokens and common focus, input, button,
       card, notice, loading, and disabled states.
2. [x] Apply the shared visual language to home, authentication, administration,
       and folder-management screens without changing their behavior.
3. [x] Add browser regression assertions for the unified palette, responsive
       layout, and accessibility while retaining the projection assertions.
4. [x] Verify wide and narrow layouts in the browser and run all canonical local
       checks.
5. [ ] Open the pull request, verify every required check on its exact head,
       merge, and synchronize `main`.

## Progress

- 2026-08-23 JST — Started; audited all page routes and the relevant sections of
  `src/app/styles.css`, component markup, and E2E coverage.
- 2026-08-23 JST — Created Issue #148 and isolated branch/worktree; acquired the
  Issue writer lease.
- 2026-08-23 JST — Completed shared tokens and modern surfaces in
  `src/app/styles.css`; preserved the scripture-search and audience contracts.
- 2026-08-23 JST — Added home, login, administration, and narrow-layout E2E
  assertions; `pnpm test:e2e` passed 9 tests.
- 2026-08-23 JST — Visually verified home, login, scripture search, and folder
  list at wide and 390px browser widths; the narrow pages had no horizontal
  overflow.
- 2026-08-23 JST — Fixed a Strict Mode asynchronous-load race discovered by
  E2E, preventing a late discarded request from overwriting an edited bookmark
  title; added focused component coverage.
- 2026-08-23 JST — Final local evidence passed: `mise run check` (166 unit and
  36 component tests plus production build), `pnpm test:integration` (74 tests),
  `pnpm test:e2e` (9 tests), and `pnpm security:check`.

## Decisions

- 2026-08-23 — Decision: retain `/scripture/audience` unchanged.
  - Reason: it is an intentionally fixed Ginmaku-compatible congregation view,
    while this Issue targets Levi's application interface.
  - Alternatives: applying the general card/control system to the projection
    screen was rejected because it would violate the approved display contract.
- 2026-08-23 — Decision: centralize the established scripture-search palette in
  CSS custom properties and reuse it across the other screens.
  - Reason: this removes visual drift without introducing a dependency or a
    component-system migration.
  - Alternatives: a new UI library was rejected as unnecessary scope and
    dependency cost.

## Risks and mitigations

- Risk: global selectors can alter the Ginmaku-compatible search or projection
  surfaces.
  - Mitigation: keep legacy-specific selectors more specific and retain exact
    E2E color/typography assertions for search and audience screens.
- Risk: more compact surfaces can overflow on narrow Chrome viewports.
  - Mitigation: add responsive layout rules and browser assertions at 390px.
- Risk: dark controls can lose visible focus, error, or disabled states.
  - Mitigation: use a shared gold focus ring, semantic notice colors, disabled
    contrast, and Axe checks.

## Verification

- [x] `mise run check`
- [x] `pnpm test:integration` — explicit disposable test DB on port 55433
- [x] `pnpm test:e2e` — explicit disposable test DB on port 55433
- [x] `pnpm security:check`
- [x] Wide and 390px browser screenshots for representative screens
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, responsive browser review, regression coverage,
  and all local verification.
- Remaining: PR, exact-head CI verification, merge, and `main` synchronization.
- Blocker: none.
- Resume with: update the shared design tokens and common surface styles in
  `src/app/styles.css`.

## Result

Pending implementation and verification.
