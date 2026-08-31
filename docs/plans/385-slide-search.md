# Tenant-scoped literal Slide search and pagination

## Issue and context

- Issue #385, parent #59, dependencies #382/#383; API/editor #394/#384 merged.
- Branch `codex/issue-385`, base `60368e3`.
- Follow ADR 0015, Slide contract, governance and testing policy. Next 16.3.1
  route/client documentation inspected for the preceding compatible API/UI work.

## Plan

1. [ ] Validate normalized, untrimmed query and versioned query-bound cursor.
2. [ ] Implement scoped metadata-only recent/list/search API and literal SQL.
3. [ ] Add list states, search, previous-cursor history and responsive UI.
4. [ ] Prove ordering, tenant boundaries, wildcard/case rules, cursor tampering,
       live membership and 100/10,000-row synthetic EXPLAIN evidence.
5. [ ] Check, integration, E2E, security, separate review, PR and exact-head CI merge.

## Decisions and constraints

- Use deterministic `C` collation plus explicit ASCII translate, not locale lower.
- Cursor is a bounded strict JSON string containing version, normalized query,
  creation timestamp and UUID. It is not an authorization token. Tenant always
  comes from the authenticated scope; neither request nor cursor accepts church ID.
- Return only ID/title/author/revision/timestamps, never all bodies in a list.
- No extension, dependency, schema change, production content or operation.
- Reverting the search app change leaves schema and content intact.

## Progress / blockers

- 2026-08-31 JST — Intake complete and isolated from current main. No blockers.
- Verification pending; final exact commands/results will be in the PR.

- Implemented normalized strict query/cursor, metadata-only scoped SQL/API and
  list UI with filter reset/history and persistent disabled pagination controls.
- Initial test failures exposed a fixture status typo, an assertion racing the
  loading status, and a detached pagination button. Corrected status/awaiting;
  preserved pagination DOM/focus through pending requests. No retries introduced.
- Lease was acquired after the first local edit batch while dependencies finished,
  rather than before it; acquisition found no competing writer. Subsequent edits
  use the active #385 lease. Keep acquire-before-edit ordering for the next Issue.
- `pnpm test:integration`: PASS 128; literal/case/cursor/tenant/live membership.
- `pnpm check`: PASS 413 unit / 84 component tests, lint/typecheck/build before
  final multiline-search UI adjustment; final rerun and E2E pending.
- Synthetic 100/10,000-row EXPLAIN recorded in `docs/testing-slide-search-performance.md`.
  Rare/absent 10,000-row search costs ~406–418 ms locally; follow-up #397, no
  production performance claim or new search provider.

## Final review

- Separate review checked SQL parameterization/C collation, tenant scoping,
  metadata bounds, live keyset semantics, cursor validation, stale-response guards,
  error/no-store responses and keyboard focus. Tightened cursor timestamps to
  storage millisecond precision and excluded PostgreSQL-invalid year zero.
- `pnpm test:e2e`: PASS all 24 Chromium scenarios, including actual GET
  authentication, foreign tenant exclusion, recent/all/search/back/reset, literal
  metacharacters and ASCII matching. 390/1280 screenshots visually reviewed; axe
  and horizontal bounds passed. Existing editor/scripture E2E retained.
- `pnpm security:check`: PASS, no known vulnerabilities and 315 license records.
- `pnpm test:unit:coverage`: PASS 94.51% lines / 85.95% branches before the final
  timestamp guard; final check/integration/coverage rerun recorded in PR #398.
- No unresolved correctness findings. Performance follow-up #397 remains open.
