# Expand scripture audience content while preserving fit

## Issue

- Issue: #482
- Branch: `codex/issue-482`
- Base commit: `cbbb2ed6a0cccb9000362b17dc8e5f97cf83b0a2`

## Outcome

The scripture audience uses the viewport below its heading as the actual text
region, removes font-relative paragraph whitespace, and renders at a larger base
size while continuing to fit all content without scrolling or clipping.

## Context

- `src/app/styles/audience.css` vertically centers content over the full screen,
  shifts it upward, and applies `1em` top and bottom margin to each translation.
- `src/app/church/audience/use-audience-fit.ts` estimates usable height by
  subtracting the heading twice instead of measuring the rendered content area.
- The user-provided 2700×1328 screenshot is a visual problem reference only. It
  shows large unused vertical space; it is not a repository asset or source of
  instructions.
- Issue #220 established iterative measured fitting, resize/font-ready refitting,
  and a no-scroll audience surface.

## Constraints

- Preserve heading, verse number, Japanese-English order, colors, text shadow,
  black background, controls, transport, authorization, and fail-closed states.
- Keep 60–220% user scale semantics and isolate this change from Slide layout.
- Fit at wide and compact Chrome viewports without scroll or clipping.
- Follow repository governance and Definition of Done.

## Non-goals

- User-configurable positioning or language spacing.
- Scripture text, translation labels, control UI, or Slide projection changes.
- New dependencies.

## Plan

1. [x] Give the heading and content explicit grid regions and reclaim
       font-relative paragraph whitespace.
2. [x] Measure the actual content region in the fit hook and retain a finite
       fallback for extreme content.
3. [x] Extend browser regression checks for larger text, region use,
       heading separation, compact viewport fit, and no overflow.
4. [x] Update the product contract and run relevant and canonical verification.

## Progress

- 2026-09-05 22:10 JST — Created Issue #482 and an isolated worktree. Inspected
  governance, testing guidance, version-matched Next.js client documentation,
  Issue #220 history, the product protocol, current audience CSS, fit hook, and
  existing component/E2E coverage.
- 2026-09-05 22:20 JST — Implemented the explicit heading/content grid, 80px
  base, compact language gap, actual-region measurement, and lower extreme-fit
  floor. Targeted unit (3) and component (7) tests passed. Full E2E passed all 35
  tests, including the new region-use, >64px, 1280×720, 640×360, forced-size,
  heading-separation, and no-overflow assertions.
- 2026-09-05 22:21 JST — Final CSS review found waiting and navigation-error
  states would otherwise participate in the new two-row grid. Kept waiting
  centered in an independent row and navigation errors out of layout flow.
- 2026-09-05 22:23 JST — The post-review audience component suite passed (7).
  `mise run check` passed formatting, lint, typecheck, 498 unit tests, 118
  component tests, configuration checks, and production build. `git diff
--check` passed; final diff review found no API, database, transport, Slide,
  secret, or generated-file changes.

## Decisions

- 2026-09-05 — Decision: model the screen as a heading row plus a measured
  `minmax(0, 1fr)` content row and remove the translated paragraph margins.
  - Reason: this directly assigns all space below the heading to content and
    avoids whitespace growing with font scale.
  - Alternatives: adjusting the existing negative translation or guessed
    heading multiplier retains fragile overlap/unused-space behavior.
  - ADR: Not required; this is reversible presentation layout.
- 2026-09-05 — Decision: raise the scripture base from 64px to 80px and let the
  existing fit scale reduce it only when rendered dimensions require it.
  - Reason: it provides a measurable readability improvement for content that
    fits, while preserving no-overflow behavior for longer content.
  - Alternatives: changing the saved percentage defaults would alter user
    preferences; viewport-only sizing does not account for text length.
  - ADR: Not required.

## Risks and mitigations

- Risk: the larger base could clip extreme or forced-size content.
  - Mitigation: fit against the actual content element and extend the finite
    search floor, with wide/compact E2E overflow checks.
- Risk: a heading wrap could reduce available content after initial measure.
  - Mitigation: CSS grid owns the region split and ResizeObserver observes the
    content region in addition to the screen.
- Risk: shared styles could affect Slides.
  - Mitigation: change only scripture `.audience-*` selectors and retain Slide
    regression coverage in the full suite.

## Verification

- [x] `pnpm test:unit` — 498 passed
- [x] `pnpm test:component` — 118 passed
- [x] `pnpm test:e2e` — 35 passed
- [x] `mise run check` — passed
- [x] `git diff --check` — passed
- [x] Acceptance criteria verified and final diff reviewed

## Handoff or blockers

- Completed: implementation, tests, documentation, and local verification.
- Remaining: commit, PR, required CI, and merge.
- Blocker: none.
- Resume with: commit and push the reviewed audience layout change.

## Result

The scripture audience now allocates the viewport below its heading directly to
the body, uses compact language spacing and an 80px base, and measures that
rendered region when fitting. Wide, compact, and forced-size browser checks fit
without overlap, scrolling, or clipping. Merge awaits required CI.
