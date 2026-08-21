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

1. [ ] Define runtime input parsing, language mode, result contract, and domain
       errors with golden unit cases.
2. [ ] Implement one-query Prisma catalog reader and deterministic pairing with
       synthetic PostgreSQL cases for all modes and integrity failures.
3. [ ] Add authenticated GET route behavior and unit tests for auth/input/domain
       response boundaries and no-store responses.
4. [ ] Capture representative `EXPLAIN` evidence and update parity/docs.
5. [ ] Run local and exact-commit CI gates, then merge.

## Progress

- 2026-08-21 17:00 JST — Started from merged Issue #48; updated the stale KJV
  acceptance wording to NKJV, acquired the writer lease, and read the pinned
  Next.js 16 route-handler documentation.

## Decisions

- 2026-08-21 — Use query parameters on authenticated `GET /api/scripture/search`.
  - Reason: this is an idempotent bounded catalog read whose complete selection
    has a natural URL representation.
  - Alternative: POST JSON; rejected because no mutation or unbounded payload is
    involved.

## Risks and mitigations

- Risk: bilingual rows silently mispair or disappear.
  - Mitigation: group by canonical location and require exactly the requested
    translation set for every item.
- Risk: invalid input reaches Prisma or leaks catalog shape.
  - Mitigation: strict parser and stable error mapping before repository access.

## Verification

- [ ] golden unit cases
- [ ] PostgreSQL integration cases
- [ ] representative `EXPLAIN` uses catalog indexes
- [ ] `pnpm db:check`
- [ ] `pnpm check`
- [ ] `pnpm test:integration`
- [ ] `pnpm security:check`
- [ ] `git diff --check`

## Handoff or blockers

- Completed: intake, corrected NKJV contract, framework review, plan.
- Remaining: implementation, evidence, CI, merge.
- Blocker: none.
- Resume with: implement the framework-independent parser and result assembler.

## Result

Pending implementation.
