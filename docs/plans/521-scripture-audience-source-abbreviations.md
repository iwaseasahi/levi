# Use source abbreviations in scripture projection

## Issue

- Issue: #521
- Branch: `codex/issue-521`
- Base commit: `57839af6e7ec3b64de26c9181db73db9da0798f0`

## Outcome

The scripture audience uses the exact English book abbreviation carried by the
NKJV book-name data, matching the scripture selection screen after initial load
and every navigation step.

## Context

- `src/app/church/audience/audience-view.tsx` currently derives `Gen` and `Exo`
  by title-casing the canonical codes `GEN` and `EXO`.
- Search and navigation results already carry the translation-specific
  `BibleBookName.name` in `ScriptureSearchItem.texts.english.bookName`.
- The production source data uses values such as `GEN` and `EX`; `EX` proves
  that the displayed abbreviation is distinct from the canonical code `EXO`.
- Issue #515 established the current header layout and single-line behavior.

## Constraints

- Reuse the existing NKJV book-name value; do not add another abbreviation map,
  API field, schema change, or data migration.
- Preserve Japanese-only and English-only behavior, body content, attribution,
  fitting, blanking, authorization, and navigation.
- Preserve the single-line responsive header and accessible heading name.
- Follow repository governance; production deployment is outside this Issue.

## Non-goals

- Changing the source abbreviations or adopting `short_name`.
- Changing the selection screen, scripture text, attribution, or Slide projection.

## Plan

1. [x] Make component fixtures representative of source abbreviations and add
       assertions that distinguish `EX` from canonical code `EXO`.
2. [x] Render the English translation's `bookName` verbatim in the audience.
3. [x] Align the synthetic E2E catalog with source abbreviations and verify
       initial, single-language, and cross-book projection behavior.
4. [x] Update the product contract and run focused and canonical verification.
5. [ ] Review, commit, push, open the Issue-linked PR, and verify required CI.

## Progress

- 2026-09-28 21:34 JST — Created and read Issue #521 and parent Issue #515;
  read governance, execution/testing guidance, relevant ADRs, product contract,
  prior plan, and version-matched Next.js client-component documentation.
- 2026-09-28 21:34 JST — Created the dedicated worktree, installed pinned
  dependencies, and acquired the Issue writer lease.
- 2026-09-28 21:43 JST — Replaced canonical-code title casing with the exact
  English translation book name; component coverage passes for `GEN`, English
  only, and canonical `EXO` displayed as source abbreviation `EX`.
- 2026-09-28 21:43 JST — `mise run check` passed formatting, lint, typecheck,
  539 unit tests, 126 component tests, configuration checks, and production build.
- 2026-09-28 21:43 JST — Integration passed 141/141 after starting the required
  local development PostgreSQL service; Security and `db:check` passed.
- 2026-09-28 21:43 JST — The first full E2E run passed 34/35 and exposed an
  unrelated reload/blank synchronization flake in the reused-projector test;
  the isolated test then passed 1/1 and a second retries-zero full run passed
  35/35. Follow-up Issue #522 records the unrelated reliability finding.
- 2026-09-28 21:44 JST — Reviewed the complete diff against Issue #521. The
  change preserves the prior no-text fallback, introduces no schema/API change,
  and limits production behavior to consuming the existing English book name.

## Decisions

- 2026-09-28 — Decision: consume `current.texts.english.bookName` directly.
  - Reason: search and navigation already resolve the same translation-specific
    database value used by the selection catalog; `EX` cannot be reconstructed
    correctly from canonical code `EXO`.
  - Alternatives: a new fixed map would duplicate source data; `short_name`
    would require a separate data and migration decision outside this scope.
  - ADR: not required; this is a reversible presentation correction within the
    accepted normalized Bible catalog model.

## Risks and mitigations

- Risk: navigation falls back to the canonical code and diverges after crossing
  a book boundary.
  - Mitigation: component and E2E coverage use `EX` with canonical code `EXO`.
- Risk: updating representative E2E names obscures unrelated behavior.
  - Mitigation: change only synthetic book-name values and their direct visible
    assertions; retain all existing flows and body fixtures.

## Verification

- [x] Focused component test — 9 passed
- [x] Focused reused-projector E2E — 1 passed
- [x] `mise run check` — passed
- [x] `mise exec -- corepack pnpm test:integration` — 141 passed
- [x] `mise exec -- corepack pnpm test:e2e` — 35 passed, retries 0
- [x] `mise exec -- corepack pnpm security:check` — passed
- [x] `mise exec -- corepack pnpm db:check` — passed with explicit local URLs
- [x] `git diff --check` — passed
- [x] Acceptance criteria and final diff review — no findings

## Handoff or blockers

- Completed: intake, implementation, documentation, focused/canonical local
  verification, and follow-up Issue #522 for an unrelated E2E flake.
- Remaining: commit, PR, and exact-head CI.
- Blocker: none.
- Resume with: review the complete diff against Issue #521.

## Result

Implementation and local verification are complete. PR and exact-head CI remain.
