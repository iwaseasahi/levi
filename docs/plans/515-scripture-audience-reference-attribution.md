# Reposition scripture reference and attribution

## Issue

- Issue: #515
- Branch: `codex/issue-515`
- Base commit: `c02e50b584439a9c427eb5f7fe340792153fdd90`

## Outcome

The scripture audience shows the current Japanese and/or English Bible location
at the upper left in larger type and the exact JSS3 attribution at the upper
right in smaller type, without changing projection behavior or clipping the
body at supported viewport sizes.

## Context

- `src/app/church/audience/audience-view.tsx` currently combines translation,
  one preferred book name, chapter, and verse in a single heading.
- `src/app/styles/audience.css` places that 32px heading on the right above the
  measured body region.
- A `ScriptureSearchItem` already contains the Japanese book name and canonical
  English book code for the current location, so `創世記 / Gen 1:1`-style
  references require no API or persistence change.
- Issues #220, #482, #484, and #488 established measured body fitting, the
  heading/body grid, language spacing, inset, and current 32px heading size.

## Constraints

- Render the attribution `聖書 新改訳 ©︎2003 日本聖書刊行会`, using the text
  presentation selector so the copyright mark inherits the surrounding color.
- Preserve body content, verse number, Japanese-English order, colors, shadow,
  font controls, measured fitting, navigation, blanking, authorization, and
  fail-closed behavior.
- Preserve an `h1` for the current location and keep loading, error, ready, and
  blank states accessible.
- Keep the reference and attribution on one line; use responsive type sizes at
  the compact viewport rather than wrapping either label.
- Support the normal and compact latest-Chrome viewports covered by E2E.
- Follow repository governance; production deployment is outside this Issue.

## Non-goals

- Scripture search, text, API, database, projection transport, or Slide changes.
- A persisted or user-editable attribution system.
- Adding a separate NKJV attribution.

## Plan

1. [x] Add focused component coverage for Japanese, English, and bilingual
       locations plus the exact attribution and hidden states.
2. [x] Split the audience header into a larger left location and smaller right
       attribution while retaining the measured body row.
3. [x] Extend latest-Chromium layout and navigation assertions for alignment,
       typography, no-wrap behavior, non-overlap, overflow, and location synchronization.
4. [x] Update the projection product contract and run focused and canonical
       verification.
5. [ ] Review the complete diff, commit, open the Issue-linked PR, and verify
       required CI on the exact head.

## Progress

- 2026-09-28 JST — Created and read Issue #515; confirmed it has no parent or
  dependency Issues. Read governance, execution/testing/migration guidance,
  product contracts, relevant ADRs and history, and version-matched Next.js
  client-component/CSS documentation. Created the dedicated worktree and
  acquired the writer lease.
- 2026-09-28 JST — Confirmed bilingual display is supported by the existing
  `ScriptureSearchItem` contract and made the Issue ready with UI states,
  responsive behavior, accessibility, non-goals, and verification criteria.
- 2026-09-28 JST — The user selected `創世記 / Gen 1:1` and explicitly excluded
  wrapping. Implemented the bilingual/single-language labels, exact attribution,
  responsive single-line 40px/24px header, and component/E2E regressions.
- 2026-09-28 JST — `mise run check` passed formatting, lint, typecheck, 539 unit
  tests, 126 component tests, configuration checks, and the production build.
  Integration passed 141/141 after starting the documented local development
  database; `db:check` found no migration/schema drift and verified seed/connectivity.
- 2026-09-28 JST — Focused latest-Chromium projection and language-mode E2E
  passed 2/2. The earlier full 35-test run passed the changed projection scenario
  and 33 other tests; an unrelated Slide sidebar expansion failure is recorded
  in #517. A newly reported high-severity `nodemailer@9.0.6` advisory blocks the
  local Security gate and is recorded in #516.
- 2026-09-28 JST — Committed the reviewed patch as `7004ec7`, pushed
  `codex/issue-515`, and opened draft PR #518 with the verification evidence and
  follow-up blockers recorded below.
- 2026-09-28 JST — At the user's request, changed the copyright mark from emoji
  presentation (`©️`) to text presentation (`©︎`) so it renders in the same
  yellow as the rest of the attribution.
- 2026-09-28 JST — The user accepted the updated screenshot and requested the
  merge. Dependency security PR #519 passed all four required checks and merged,
  closing #516; its repaired `main` was merged into this branch.

## Decisions

- 2026-09-28 — Decision: derive the visible location entirely from the selected
  item and render bilingual locations as `日本語書巻名 / EnglishAbbrev 章:節`,
  for example `創世記 / Gen 1:1`.
  - Reason: the user selected this exact format; the existing uppercase
    canonical code supplies the compact English abbreviation and stays
    synchronized through all existing navigation paths.
  - Alternatives: a Japanese-only preferred name would not meet the bilingual
    request; new API fields or duplicated location state are unnecessary.
  - ADR: not required; this is a reversible presentation change.
- 2026-09-28 — Decision: keep the attribution fixed to the exact requested JSS3
  wording whenever scripture is visible.
  - Reason: the user specified the exact wording and placed persistence or a
    separate NKJV notice outside the requested scope.

## Risks and mitigations

- Risk: long bilingual book names and the fixed attribution overlap at compact
  widths when neither may wrap.
  - Mitigation: keep 40px/24px at normal widths, scale both labels down at the
    compact viewport, and assert single-line geometry and horizontal overflow.
- Risk: navigation updates only one localized name or leaves a stale reference.
  - Mitigation: derive both labels from `current` on every render and cover
    verse, chapter, and book navigation in component/E2E tests.
- Risk: the new attribution appears during blank or fail-closed states.
  - Mitigation: keep the whole header inside the existing ready, non-blank
    rendering branch and add component assertions.

## Verification

- [x] `mise exec -- corepack pnpm test:component` — 126 passed
- [x] focused latest-Chromium E2E — 2 passed; full run 34 passed / 1 unrelated
      failure tracked in #517
- [x] `mise run check` — passed, including 539 unit and 126 component tests
- [x] `mise exec -- corepack pnpm test:integration` — 141 passed
- [x] `mise exec -- corepack pnpm security:check` — passed after the isolated
      Nodemailer security update in #519
- [x] `mise exec -- corepack pnpm db:check` — passed
- [x] `git diff --check`
- [x] Acceptance criteria verified and final diff reviewed for scope, secrets,
      migrations, and unsafe defaults.

## Handoff or blockers

- Completed: intake, implementation, documentation, focused/canonical local
  verification, database checks, final diff review, commit, push, and draft PR
  #518; user acceptance; and prerequisite security PR #519.
- Remaining: run required exact-head CI, move PR #518 out of draft, and merge.
- Blocker: none. The earlier unrelated E2E flake remains tracked in #517 and
  does not replace the required exact-head E2E result.
- Resume with: push the refreshed branch, wait for all four required checks on
  PR #518, mark it ready, and merge it.

## Result

Implementation and prerequisite remediation are complete in draft PR #518.
Exact-head CI and merge remain pending.
