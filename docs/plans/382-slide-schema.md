# Persist church-owned slides without history

- Issue: #382; parent #59; branch `codex/issue-382`
- Base: `c9cc8084b32dc53ce3bb95a7a7e1d4bc0cb0a929`
- Contract: ADR 0015 and `docs/product/slide-contract.md`.

## Plan and scope

1. [x] Read Issue, parent, governance, schema/database and test conventions.
2. [x] Add only Slide/Church relation and forward SQL expansion with all named
       constraints/indexes, matching code point/normalization rules from #59.
3. [x] Prove invalid writes, Unicode bounds, FK and three deletion scopes,
       transaction rollback and concurrent Church deletion; keep prior admin flow.
4. [ ] Run `pnpm db:check`, `pnpm test:integration`, `pnpm check`, relevant E2E,
       security and patch checks; review complete diff; exact-head CI and merge.

No seed tenant/content is required. Application input normalization follows in
#383/#384; this Issue rejects invalid persisted representations in PostgreSQL.
No production operation, old migration edits, dependencies, or legacy import.
Expansion leaves old application behavior intact. Roll application back without
dropping a populated slides table; production apply is a separate approval.

## Progress and verification

- 2026-08-31 JST: dedicated worktree/lease acquired; inspected existing Church
  cascade/admin deletion and deterministic test fixtures; SQL expansion added.

## Handoff or blocker

- Intended outcome: constrained church-owned Slide storage.
- Completed: intake, plan and initial schema/SQL.
- Remaining: focused tests, validation, PR/CI/merge.
- Blocker: none.
- Resume with: add integration coverage and run the local test database.

- Local evidence: `pnpm db:check` passed migration, schema drift and seed;
  `pnpm test:integration` passed 121 tests including 25 new Slide cases;
  `pnpm security:check` passed (315 license records). Typecheck caught an
  unchecked fixture-array index; replaced it with an inferred Promise tuple and
  reran focused integration. Full check/E2E and final CI are recorded in the PR.
- Separate review: schema expansion does not rewrite existing rows; FK cascade
  is confined to Church-owned Slide, user deletion retains content, and the
  existing administrative deletion test proves shared/foreign data survives.
  No production access, secrets, unrelated changes or dependency changes.
