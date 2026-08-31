# Share Slide validation and page parsing

- Issue #383; parent #59; branch `codex/issue-383`.
- Follows ADR 0015 and the pinned Slide contract; schema #382 is merged.

## Plan

1. [x] Inspect parent/Issue, contract, Zod/domain and testing conventions.
2. [x] Implement normalized strict Slide input, independent body preview,
       four-LF splitting, Ruby trailing-empty behavior and first-line outline.
3. [ ] Prove all golden cases, Unicode/length/blank/unknown-input boundaries,
       absence of mutation/truncation; run unit/coverage and `pnpm check`.
4. [ ] Review diff, exact-head CI, merge and verify Issue/main. Final evidence
       belongs in the PR after this plan commit.

No UI, database migration, persistence, HTML rendering, production operations or
new dependencies. Invalid input errors contain no input text. Application/body
normalization matches the schema already merged in #382.

## Progress / Handoff

- 2026-08-31 JST: created isolated worktree and lease; pure functions and
  synthetic regression cases implemented.
- Remaining: validation, review and PR/CI/merge. Blocker: none.

- Initial standalone unit run required the new worktree's generated Prisma
  client for an existing database-retry test; canonical `pnpm check` generates
  that client before unit tests. No implementation failure was suppressed.
- Separate review checked exact ASCII whitespace versus Unicode preservation,
  code points versus UTF-16 units, no history/persistence, unknown field rejection
  and generic content-free errors. All examples use synthetic text.
