# Bible catalog schema

## Issue

- Issue: #46
- Branch: `codex/issue-46`
- Base commit: `9c92881`

## Outcome

Levi stores translations, canonical books, translation-specific names, and
verses in a normalized shared catalog whose identity and navigation never rely
on legacy or physical row IDs. PostgreSQL enforces stable metadata, positive and
unique locations, restrictive master relationships, and the content-rights
gate metadata required by ADR 0007.

## Plan

1. [x] Map ADR 0007 enums and four catalog models in Prisma.
2. [x] Implement an immutable migration with named checks, unique keys,
       navigation index, and restrictive foreign keys.
3. [x] Seed only deterministic JSS3/KJV `PENDING` metadata and prove that the
       seed contains no Bible text.
4. [x] Test allowed and rejected synthetic metadata, names, locations, deletion,
       raw constraints, and indexes against PostgreSQL.
5. [ ] Run canonical checks and merge only the exact commit passing all four
       required GitHub jobs.

## Decisions

- No real Bible text, source contract, or rights notice is added. The two known
  translations remain `PENDING` until the documented human rights gate is
  satisfied.
- Synthetic integration text is explicitly non-scriptural and exists only for
  disposable constraint tests.
- `BibleVerse.text` is `NOT NULL`, but the intentionally deferred nonblank check
  is absent until the approved dump profile in Issue #47 establishes evidence.

## Verification

- [x] Empty-schema migration reconstruction and drift check
- [x] PostgreSQL integration constraints (38 suite tests; 6 catalog-specific)
- [x] `pnpm check`
- [x] `pnpm security:check`
- [x] `git diff --check`

## Progress

- 2026-08-21 16:03 JST — Added the normalized schema, raw migration, pending
  translation metadata seed, no-text seed assertion, and focused constraint
  tests. Database reconstruction/drift checks and all 38 integration tests pass.
- 2026-08-21 16:05 JST — Canonical quality/build and security checks pass: 51
  unit, 10 component, and 38 PostgreSQL integration tests. The schema migration
  is ready for exact-commit CI verification.

## Result

The shared catalog now has explicit translation rights state, translation-
independent canonical books, translation-specific names, and ID-independent
verse locations. PostgreSQL rejects invalid metadata, duplicate or non-positive
locations, missing parents, and destructive master deletion. Only JSS3/KJV
`PENDING` metadata is seeded; no real Bible text or rights material is included.
