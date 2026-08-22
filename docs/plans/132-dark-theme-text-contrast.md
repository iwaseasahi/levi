# Restore dark-theme text contrast across Levi

## Issue

- Issue: #132
- Branch: `codex/issue-132`
- Base commit: `0c2c7e463b01c0215a18cd5b1655b4782d4562bc`

## Outcome

Text and controls remain readable throughout Levi's black-themed screens. The
folder creation submit button and every related folder/bookmark action use the
foreground color assigned by their dark-theme component style, while native
light Ginmaku controls keep their intentional black text.

## Context

- The root theme, authentication, administration, scripture search, and
  audience styles explicitly assign contrasting foreground colors.
- The Ginmaku folder sidebar has a high-specificity rule that forces every
  nested button to the browser system `buttontext` color.
- Chrome resolves that system color to black in the reported environment. The
  rule consequently overrides white secondary controls, red destructive
  controls, folder toggles, bookmarks, and order controls on dark surfaces.
- The native `Open`, `Reset`, direct projection, and blank/display buttons are
  outside the folder sidebar and intentionally use a light native background.

## Constraints

- Preserve the Ginmaku-compatible layout and native appearance of the scripture
  search controls.
- Preserve existing button behavior, accessibility names, and disabled states.
- Fix the shared cascade cause instead of adding one-off declarations to every
  affected button.
- Verify computed styles in latest Chromium, since DOM visibility does not prove
  readable foreground contrast.

## Non-goals

- Redesigning Levi's black visual theme.
- Changing folder or bookmark behavior and persistence.
- Restyling the intentionally native, light-background Ginmaku controls.

## Plan

1. [x] Audit foreground/background declarations and classify intentional dark
       text on light controls separately from regressions on dark surfaces.
2. [x] Add rendered regression coverage for folder creation and representative
       folder/bookmark actions.
3. [x] Remove the sidebar-wide system foreground override so each component's
       existing accessible color can take effect.
4. [ ] Run canonical verification and merge only after exact-head required CI
       succeeds.

## Progress

- 2026-08-23 JST — Audited the site-wide stylesheet and all application button
  call sites. Found one shared high-specificity `buttontext` override responsible
  for the reported button and the other dark sidebar actions.
- 2026-08-23 JST — Reproduced the creation button as computed black text in
  Chromium, removed the shared override, and verified white normal actions plus
  the existing light-red destructive action on dark surfaces.
- 2026-08-23 JST — Passed the complete E2E suite, focused rendered color-contrast
  analysis, canonical check, production dependency audit, and license policy.

## Decisions

- 2026-08-23 — Remove the foreground override while retaining the compact
  dimensions and native font reset of sidebar buttons.
  - Reason: existing component rules already define white, inherited, or
    destructive foreground colors appropriate to their surfaces.
  - Alternative: set every sidebar button to white; rejected because it would
    erase the intentional red destructive-action foreground.
- 2026-08-23 — Keep native scripture controls unchanged.
  - Reason: their black system foreground is paired with a light native button
    surface and matches the requested Ginmaku behavior.

## Risks and mitigations

- Risk: a broad CSS change could alter native scripture controls.
  - Mitigation: scope the change to the existing folder-sidebar selector and
    assert both dark-sidebar and native-control computed styles in Chromium.
- Risk: only the initially reported creation button is tested.
  - Mitigation: cover folder toggles, secondary actions, destructive actions,
    bookmarks, and order controls after creating representative data.

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: CSS/call-site audit, regression test, shared cascade fix, and local
  canonical verification.
- Remaining: PR, exact-head CI, merge, lease release, and main synchronization.
- Blocker: none.
- Resume with: commit the verified change and open the PR.

## Result

The folder sidebar no longer forces browser-system black text onto dark
controls. Creation, rename, pin, folder toggle, bookmark, and ordering controls
inherit white foregrounds; destructive controls retain the accessible error
foreground; native light scripture controls remain unchanged.
