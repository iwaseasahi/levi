# Unify every screen with the black scripture-search theme

## Issue

- Issue: #118
- Branch: `codex/issue-118`
- Base commit: `c743be521da4779566d5b250445d093651d40e2e`

## Outcome

Every Levi route uses the scripture-search screen's black-first visual language
without changing its content, authorization, or workflow.

## Context

- `src/app/styles.css` is the single global stylesheet imported by the root
  layout and already contains both the light application surfaces and the
  Ginmaku-compatible black scripture-search/audience surfaces.
- The remaining light surfaces are the home card, authentication card,
  operator forms and notices, saved-content defaults, and legacy projection
  controller cards.
- The audience and scripture-search layouts are binding compatibility behavior;
  their typography and spatial layout must remain unchanged.

## Constraints

- Preserve DOM structure, accessible names, focus movement, routes, and data
  behavior.
- Keep white text and orange focus outlines at accessible contrast on black and
  dark-gray surfaces.
- Retain semantic error, success, connection, selection, and disabled states.
- Use the existing global stylesheet; do not add a theme dependency or runtime
  theme switch.
- Merge only after protected exact-head CI succeeds.

## Non-goals

- Layout redesign, content changes, theme selection, or schema/API changes.
- Changes to Ginmaku audience typography or scripture placement.

## Plan

1. [x] Inventory every route and light surface; confirm the global CSS boundary.
2. [x] Introduce shared dark design tokens and convert generic, auth, admin,
       saved-content, notice, and projection surfaces.
3. [x] Add latest-Chrome regression assertions for representative public,
       authentication, administration, church, projection, and audience states.
4. [x] Update product documentation and run canonical local verification.
5. [ ] Self-review, push, open PR, verify exact-head CI, merge, and close #118.

## Progress

- 2026-08-22 11:35 JST — Created and read Issue #118; inspected all app routes,
  the global stylesheet, product accessibility requirements, and existing
  component/E2E coverage.
- 2026-08-22 11:50 JST — Added the shared black palette and converted all light
  application surfaces; latest-Chromium E2E passed 9/9 with axe and computed
  color assertions across the representative routes.
- 2026-08-22 11:53 JST — Visually inspected the rendered home and login screens
  in the local browser at full-page scale; black backgrounds, dark panels,
  white text, dark inputs, and orange actions rendered without layout regressions.

## Decisions

- 2026-08-22 — Decision: centralize the palette as CSS custom properties and
  retain targeted Ginmaku overrides.
  - Reason: every route already imports one global stylesheet, while the search
    and audience surfaces require narrower compatibility rules.
  - Alternatives: per-route CSS modules would duplicate the palette; a runtime
    theme system is outside the requested fixed black design.
  - ADR: not required; this is a reversible presentation-only refactor.

## Risks and mitigations

- Risk: changing global colors reduces readability or loses semantic states.
  - Mitigation: use high-contrast tokens, keep labelled state components, run
    axe in component and Chrome E2E tests, and assert computed colors.
- Risk: generic rules alter Ginmaku-compatible native controls or audience text.
  - Mitigation: retain and verify the existing scoped search/audience selectors
    after the global palette changes.
- Risk: authenticated routes are missed by public-page visual checks.
  - Mitigation: extend existing authenticated E2E flows with reusable surface
    assertions for admin, password, church, projection, and audience routes.

## Verification

- [x] focused component and latest-Chrome visual-state assertions
- [x] `mise exec -- pnpm check`
- [x] database, integration, E2E, and security checks
- [x] `git diff --check`
- [x] final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: Issue intake, route/style inventory, and execution plan.
- Remaining: protected PR verification and merge.
- Blocker: none.
- Resume with: commit, push, and open the Issue #118 PR.

## Result

Pending implementation and verification.
