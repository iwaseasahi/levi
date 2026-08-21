# Beyond-range and chapter-boundary scripture navigation

## Issue

- Issue: #52
- Branch: `codex/issue-52`
- Base commit: `18f41eb`

## Outcome

Projection previous/next follows adjacent existing canonical locations within
the same book, beyond the searched range and across chapter boundaries.

## Context

- Issue #51 currently navigates only the initial result array.
- Issue #53 owns transitions between canonical books.
- JSS3/NKJV must remain one logical bilingual location.

## Constraints

- Navigation compares `(chapter_number, verse_number)`, never array indexes,
  row IDs, or assumed contiguous verse numbers.
- The next canonical location is selected from the approved corpus first; a
  missing requested translation at that location is an explicit integrity
  error, not silently skipped.
- A same-book edge is returned as a stable non-error state for Issue #53 to
  extend.
- Rapid actions execute serially in input order.

## Non-goals

- Crossing book or testament boundaries.
- Persisting projection position.

## Plan

1. [x] Define strict navigation input/result/error contracts and boundary-table
       unit tests.
2. [x] Implement one-query same-book adjacent-location repository with
       PostgreSQL integration and query-plan evidence.
3. [x] Add the authenticated navigation API and serial controller navigation.
4. [x] Extend the real-passage two-window Chrome E2E beyond the ending verse and
       across both chapter directions.
5. [x] Update parity/docs, pass exact-commit CI, and merge.

## Progress

- 2026-08-21 18:15 JST — Started from merged Issue #51, corrected stale KJV
  wording to NKJV, and acquired the writer lease.
- 2026-08-21 18:42 JST — Completed the strict domain/API contract, one-query
  PostgreSQL navigation, serialized controller actions, and two-window Genesis
  1:1 E2E. Local unit (114), component (20), integration (59), and Chrome E2E
  (9) tests pass with build, database, and security gates.
- 2026-08-21 18:45 JST — Pull request #75 passed Quality, Database, E2E, and
  Security on implementation commit `a087405`; recorded final evidence before
  the required exact-final-commit CI rerun and merge.

## Decisions

- 2026-08-21 — Return an explicit same-book edge with no item.
  - Reason: reaching an edge is expected control state, while Issue #53 can
    replace it with canonical-book traversal without changing error semantics.
- 2026-08-21 — Queue navigation actions instead of aborting or dropping them.
  - Reason: two rapid next clicks should deterministically advance twice and
    next-then-previous should preserve user input order.

## Risks and mitigations

- Risk: missing verse numbers cause arithmetic navigation errors.
  - Mitigation: query the nearest existing tuple with ordered comparison.
- Risk: bilingual locations drift.
  - Mitigation: resolve one canonical location, then require every selected
    translation at exactly that location.

## Verification

- [x] boundary-table unit tests
- [x] PostgreSQL integration and EXPLAIN
- [x] two-page latest-Chrome E2E
- [x] repository gates and exact-commit GitHub CI

## Handoff or blockers

- Blocker: none.
- Resume with: verify the evidence-only final commit in CI, merge pull request
  #75, release the lease, and update parent Issue #38.
