# Define the normalized Levi data model

## Issue

- Issue: #41
- Branch: `codex/issue-41`
- Base commit: `82816f7d12aafc36661092ee2c14586560d4c8c9`

## Outcome

An accepted logical and physical data-model decision defines authentication,
tenancy, Bible catalog, folder, and typed scripture-bookmark integrity before
schema implementation begins.

## Context

- `docs/architecture/0002-prisma-postgresql.md`
- `docs/architecture/0006-better-auth-database-sessions.md`
- `docs/architecture/database-conventions.md`
- `docs/product/initial-release-spec.md`
- `docs/migration/legacy-inventory.md`
- `prisma/schema.prisma`
- Better Auth core database and Prisma adapter documentation
- Prisma/PostgreSQL constraint, index, and extension documentation

## Constraints

- Preserve Better Auth's core table/query contract while keeping Levi actor and
  tenant authorization explicit.
- The database must reject cross-tenant ownership, invalid scripture ranges,
  duplicate positions, invalid canonical locations, and invalid deletion scope.
- Use UUIDs and UTC `timestamptz`; nullable columns require domain meaning.
- Do not read, copy, or expose the unapproved MySQL dump or Bible text.
- Do not implement schema, import data, or run a production migration in this
  Issue.

## Non-goals

- Prisma model or migration implementation
- Legacy data profiling or import
- Slide, praise-song, PDF, or generalized polymorphic storage

## Plan

1. [x] Confirm Better Auth and PostgreSQL/Prisma physical contracts from primary
       documentation.
2. [x] Define entities, ownership, constraints, indexes, and deletion behavior.
3. [x] Record the accepted ADR, Mermaid ER diagram, and physical dictionary.
4. [x] Define representative queries, reorder concurrency, staged migrations,
       and integration-test matrix.
5. [x] Align dependent Issues and architecture indexes.
6. [ ] Run repository checks, open a PR, pass protected CI, and merge.

## Progress

- 2026-08-21 14:06 JST — Resumed after the Codex-only policy change; inspected
  Issue #41, current Prisma schema, accepted auth/product ADRs, migration
  evidence policy, and legacy table inventory.
- 2026-08-21 14:08 JST — Confirmed Better Auth core User/Session/Account/
  Verification fields and Prisma adapter generation-only behavior from current
  official documentation. Confirmed Prisma/PostgreSQL support boundaries for
  `citext`, CHECK constraints, and partial indexes.
- 2026-08-21 14:11 JST — Added accepted ADR 0007, Mermaid ER diagram, complete
  physical dictionary, deletion matrix, query/index rationale, serialized
  reorder contract, staged migration plan, and integration-test matrix.
- 2026-08-21 14:12 JST — Aligned architecture indexes/open decisions and added
  the binding ADR implementation contract to Issues #42, #46, #47, #54, and
  #55.
- 2026-08-21 14:15 JST — All local quality, integration, Chromium E2E, and
  security checks passed; reviewed the complete diff against every Issue #41
  deliverable and confirmed it contains no dump data or Bible text.

## Decisions

- 2026-08-21 — Decision: use normalized domain tables and explicit aggregate
  ownership; do not reproduce legacy route-parameter JSON or introduce a generic
  polymorphic content table.
  - Reason: the initial product types and ownership boundaries are known and DB
    constraints must remain inspectable.
- 2026-08-21 — Decision: keep Better Auth core tables compatible and extend the
  User row only with server-owned `mustChangePassword`.
  - Reason: forced password change is identity-wide, while tenant authorization
    remains in membership tables.
- 2026-08-21 — Decision: use PostgreSQL `citext` plus normalized-write CHECK for
  global email uniqueness.
  - Reason: application normalization alone cannot prevent case-variant races.

## Risks and mitigations

- Risk: Better Auth changes its generated schema contract.
  - Mitigation: pin the package, compare generated candidate schema in Issue
    #42, and treat migration output as review input rather than executable truth.
- Risk: the unavailable dump contains empty Bible text.
  - Mitigation: require non-null text but defer a nonblank CHECK until the
    approved profiling and reconciliation gate in Issue #47.
- Risk: redundant tenant keys drift.
  - Mitigation: enforce composite foreign keys so Bookmark church ownership must
    match its Folder.

## Verification

- [x] `pnpm format:check` — passed
- [x] `pnpm lint` — passed
- [x] `pnpm check` — typecheck/build, 19 unit, and 2 component tests passed
- [x] `pnpm test:integration` — 6 tests passed
- [x] `pnpm test:e2e` — 1 Chromium test passed
- [x] `pnpm security:check` — no high vulnerabilities; 214 licenses approved
- [x] Every Issue #41 deliverable maps to an ADR/dictionary section
- [x] Final diff reviewed for scope, secrets, Bible text, and unsafe migration
      claims

## Handoff or blockers

- Completed: research, accepted ADR/dictionary, dependent-Issue alignment, local
  verification, and Codex review.
- Remaining: open PR, pass protected CI, and merge.
- Blocker: none. The empty-Bible-text constraint is intentionally gated on
  approved profiling evidence in Issue #47.
- Resume with: commit the verified documentation change and open the PR.

## Result

ADR 0007 accepts a normalized identity/tenant/Bible/bookmark design with named
database constraints, explicit aggregate deletion, query indexes, serialized
reorder behavior, staged migration contracts, and a complete integration-test
matrix. Empty Bible text remains a fail-closed profiling gate in Issue #47.
