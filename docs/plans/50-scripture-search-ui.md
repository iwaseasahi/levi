# Scripture search UI and projection handoff

## Issue

- Issue: #50
- Branch: `codex/issue-50`
- Base commit: `06adc13`

## Outcome

An authenticated church user can select an eligible book, chapter, inclusive
verse range, and language, inspect the matching verses, and hand the canonical
selection to the projection workflow.

## Context

- Issue #49 supplies the authenticated deterministic range API.
- Issue #51 owns the controller/audience windows and their synchronization.
- The checked-in Next.js 16.3.1 documentation recommends keeping database reads
  in Server Components or server endpoints and limiting Client Components to
  the interactive boundary.

## Constraints

- Candidate responses contain catalog coordinates and labels, never verse text.
- Search requests and UI state contain only the text needed to show results.
- The browser URL remains clean while searching; projection handoff contains
  canonical coordinates only.
- All catalog and search endpoints re-check active church access and use
  `no-store` responses.
- Tests use synthetic text only.

## Non-goals

- Opening, synchronizing, or recovering an audience window.
- Cross-chapter projection navigation.
- Bookmarks and folders.

## Plan

1. [x] Add a strict authenticated catalog-options query for eligible books,
       chapters, and verses.
2. [x] Build the interactive search form and result list with loading, empty,
       validation, server-error, success, disabled, focus, and announcement
       states.
3. [x] Add a canonical projection handoff page without implementing the
       separate-window behavior owned by Issue #51.
4. [x] Cover the component with keyboard/accessibility tests and the complete
       latest-Chrome flow with synthetic E2E data.
5. [ ] Update parity and contracts, run local and exact-commit CI gates, then
       merge.

## Progress

- 2026-08-21 18:00 JST — Confirmed the boundary with Issue #51, acquired the
  writer lease, and read the pinned Next.js Server/Client Component, data
  fetching, and forms documentation.
- 2026-08-21 18:30 JST — Implemented cascading bilingual-safe candidates, the
  complete UI state model, canonical projection handoff, and synthetic browser
  evidence. All local quality, integration, E2E, database, and security gates
  pass.

## Decisions

- 2026-08-21 — Load cascading options through a compact catalog endpoint.
  - Reason: it avoids embedding the full two-translation verse coordinate tree
    in HTML while letting the UI prevent invalid combinations.
- 2026-08-21 — Keep search selections out of the current page URL and use only
  canonical coordinates in the projection handoff URL.
  - Reason: the search page does not need deep-link state, and verse text must
    never be serialized into navigation state.

## Risks and mitigations

- Risk: rapid selection changes render stale candidates.
  - Mitigation: ignore superseded catalog responses and reset dependent controls.
- Risk: one translation has catalog gaps.
  - Mitigation: bilingual candidates are the intersection of approved JSS3 and
    NKJV canonical locations.

## Verification

- [x] component and accessibility tests — 15 passed
- [x] latest-Chrome E2E — all 9 repository scenarios passed
- [x] `pnpm check` — 92 unit, 15 component, production build
- [x] `pnpm test:integration` — 52 passed
- [x] `pnpm db:check`
- [x] `pnpm security:check` — audit and 314 approved licenses
- [x] `git diff --check`

## Handoff or blockers

- Blocker: none.
- Resume with: run exact-commit GitHub CI and merge after all required jobs pass.
