# Deterministic scripture search domain and API

## Issue

- Issue: #49
- Branch: `codex/issue-49`
- Base commit: `5415207`

## Outcome

An authenticated active church user can request one book/chapter/inclusive
range in Japanese, English, or paired mode and receive deterministic canonical
items with explicit validation and catalog-integrity errors.

## Context

- Initial release spec defines JSS3/NKJV and one-chapter inclusive search.
- ADR 0007 provides translation/book/location uniqueness and navigation index.
- Issue #48 leaves production content and rights activation outside this Issue;
  integration tests use approved synthetic text only.
- Next.js 16 route handlers use Web `Request`/`Response` and are dynamic by
  default when request properties/database access are used.

## Constraints

- Keep parsing and search domain independent from the route handler.
- Use one bounded Prisma query with translation `IN`, never N+1.
- Require active church access even though the catalog itself is shared; never
  apply church ownership predicates to shared Bible rows.
- Return stable error codes without database or authentication details.

## Non-goals

- Search UI, projection, next/previous navigation, bookmarks, fuzzy/full-text
  lookup, or cross-chapter ranges.

## Plan

1. [x] Define runtime input parsing, language mode, result contract, and domain
       errors with golden unit cases.
2. [x] Implement one-query Prisma catalog reader and deterministic pairing with
       synthetic PostgreSQL cases for all modes and integrity failures.
3. [x] Add authenticated GET route behavior and unit tests for auth/input/domain
       response boundaries and no-store responses.
4. [x] Capture representative `EXPLAIN` evidence and update parity/docs.
5. [ ] Run local and exact-commit CI gates, then merge.

## Progress

- 2026-08-21 17:00 JST — Started from merged Issue #48; updated the stale KJV
  acceptance wording to NKJV, acquired the writer lease, and read the pinned
  Next.js 16 route-handler documentation.
- 2026-08-21 17:10 JST — Added strict range parsing, deterministic one-item-per-
  location assembly, authenticated no-store HTTP responses, and a single
  parameterized PostgreSQL catalog statement. All 81 unit and 51 integration
  tests pass; the representative plan selects a Bible location index.

## Decisions

- 2026-08-21 — Use query parameters on authenticated `GET /api/scripture/search`.
  - Reason: this is an idempotent bounded catalog read whose complete selection
    has a natural URL representation.
  - Alternative: POST JSON; rejected because no mutation or unbounded payload is
    involved.
- 2026-08-21 — Keep domain, one-query repository, and thin HTTP adapter in one
  vertical-slice PR.
  - Reason: the public error/result contract is proven across all three layers,
    there is no database migration, and rollback is a single code revert.
    Splitting would leave an unused domain or an undocumented private query
    without an independently observable user outcome.
  - Alternative: merge domain/repository before the route; rejected because the
    intermediate state does not satisfy Issue #49 and repeats CI/handoff work.

## Risks and mitigations

- Risk: bilingual rows silently mispair or disappear.
  - Mitigation: group by canonical location and require exactly the requested
    translation set for every item.
- Risk: invalid input reaches Prisma or leaks catalog shape.
  - Mitigation: strict parser and stable error mapping before repository access.

## Verification

- [x] golden unit cases — 81 unit tests passed
- [x] PostgreSQL integration cases — 51 integration tests passed
- [x] representative `EXPLAIN` uses catalog indexes
- [x] `pnpm db:check`
- [x] `pnpm check` — 81 unit, 10 component, production build
- [x] `pnpm test:integration` — 51 passed
- [x] `pnpm security:check` — audit and 314 approved licenses
- [x] `git diff --check`

## Handoff or blockers

- Completed: domain, repository, API, contract, and focused verification.
- Remaining: exact-commit CI and merge.
- Blocker: none.
- Resume with: run complete local quality/database/security gates.

## Result

Implementation and local verification are complete. Draft PR #72 remains
unmerged until its final commit passes all four required GitHub jobs.
