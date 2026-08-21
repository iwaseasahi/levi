# Cross-book scripture navigation

## Issue

- Issue: #53
- Branch: `codex/issue-53`
- Base commit: `bbab3af`

## Outcome

Projection previous/next crosses canonical book and testament boundaries while
preserving bilingual location integrity and stable whole-corpus edges.

## Constraints

- Compare `BibleBook.canonical_order`; never IDs or localized names.
- Select one canonical location from the approved corpus, then require every
  requested translation at that location.
- Preserve ordered rapid-input handling introduced by Issue #52.
- Use no production dump text in fixtures.

## Plan

1. [x] Extend the navigation snapshot and domain result with a canonical book
       location and cross-book signal.
2. [x] Query the nearest global canonical tuple and cover adjacent-book,
       testament-boundary, corpus-edge, and translation-gap cases in PostgreSQL.
3. [x] Extend the Genesis-based two-window Chrome E2E into the next canonical
       book and back.
4. [ ] Update contracts/parity, pass local and exact-commit CI gates, merge, and
       update parent Issue #38.

## Progress

- 2026-08-21 18:52 JST — Started from merged Issue #52 and acquired the writer
  lease. The existing same-book edge can be generalized without a schema change.
- 2026-08-21 18:56 JST — Implemented canonical-book and testament traversal
  with per-book indexed lateral lookup. Local unit (118), component (20),
  integration (60), and Chrome E2E (9) tests pass with build.

## Decisions

- Select the adjacent tuple globally as
  `(canonical_order, chapter_number, verse_number)`.
  - Reason: the same rule covers chapters, books, testament boundaries, missing
    verse numbers, and books with no approved corpus rows.
- Keep `book-start` and `book-end` as whole-corpus edge values.
  - Reason: callers already treat them as stable navigation exhaustion states.

## Verification

- [x] domain boundary tests
- [x] PostgreSQL book/testament/corpus boundary integration
- [x] two-page latest-Chrome E2E
- [ ] repository gates and exact-commit GitHub CI

## Handoff or blockers

- Blocker: none.
- Resume with: complete database/security gates, open the pull request, and wait
  for exact-commit CI before merge.
