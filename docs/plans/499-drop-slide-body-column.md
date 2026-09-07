# Remove the migrated Slide body column

## Issue

- Issue: #499
- Branch: `codex/issue-499`
- Base commit: `7e18fb4967c111de744340f2fa506123fa783c56`

## Outcome

Store text Slide content only in the validated application-owned
`text_document`, remove the migrated `slides.body` column and its rollback
machinery, and derive the existing plain-text response value from the document.

## Context

- ADR 0017 currently defines `body` as a duplicated rollback/read value.
- The product owner confirmed on 2026-09-07 that development and production
  data migration is complete and approved removing the column.
- `src/infrastructure/database/slide-repository.ts` owns the current fallback,
  equality check, and dual writes.
- Existing API/UI consumers can keep their current derived `body` value without
  retaining duplicate database state.

## Constraints

- Add a forward migration; do not edit merged migrations.
- Fail before dropping data if any text Slide lacks an eligible document or an
  image Slide contains one.
- Applying the migration to production and deploying are separate approval
  boundaries and are not part of this implementation.
- Preserve tenant, revision, image, bookmark, editor, projection, and API
  response behavior.

## Non-goals

- Removing the derived API `body` response field.
- Changing the rich-text schema or implementing vertical alignment from #498.
- Applying a production migration or deploying.

## Plan

1. [x] Characterize the current schema and migration/repository tests, then add
       regression coverage for document-only persistence and migration guards.
2. [x] Add the forward migration and update Prisma/repository code to remove
       stored `body` while preserving derived output.
3. [x] Update ADR, product/data documentation, and migration verification to
       describe the new source of truth and rollback boundary.
4. [x] Run focused tests, all canonical checks, review the final diff, and hand
       off a ready pull request with exact evidence.

## Progress

- 2026-09-07 JST — Started; created #499 from the owner's completed-migration
  decision and isolated `codex/issue-499` from current `main`.
- 2026-09-07 JST — Added the guarded forward migration, document-only
  repository persistence, migrated test fixtures, and contract documentation.
- 2026-09-07 JST — Verified the migration against the existing local database,
  a fresh disposable backup source database, and the full integration suite.
- 2026-09-07 JST — Full Chromium E2E passed 35/35; backup restore reconciliation
  passed with `slides_reconciled=true` and a 5-second rehearsal RTO.
- 2026-09-07 JST — Rebased onto `cb87b237`, reran the full canonical check, and
  reviewed the final diff for stored-body references and migration ordering.

## Decisions

- 2026-09-07 — Decision: retain the public/domain plain `body` value as a
  deterministic projection of `text_document`, while removing its DB column.
  - Reason: this eliminates duplicate persistence without expanding the change
    into an unrelated API and UI compatibility break.
  - Alternatives: removing every API/domain `body` field in the same change was
    rejected as unnecessary scope; retaining the column contradicts the owner
    decision.
  - ADR: update ADR 0017 in this Issue.

## Risks and mitigations

- Risk: an incompletely migrated environment loses the only copy of Slide text.
  - Mitigation: migration precondition checks fail before `DROP COLUMN`.
- Risk: image/text exclusivity weakens after the old body constraint is removed.
  - Mitigation: replace it with a `text_document`-based constraint and focused
    integration tests.
- Risk: the old rollback trigger depends on `body`.
  - Mitigation: explicitly drop the trigger and function before the column, and
    document that rollback now requires a compatible application/database pair.
- Risk: PostgreSQL CHECK expressions can accept SQL NULL when their result is
  unknown.
  - Mitigation: make the complete text/image predicate `IS TRUE` and test null
    document rejection at the SQL boundary.

## Verification

- [x] `git diff --check` — passed
- [x] `pnpm db:check` — passed after applying the forward migration
- [x] `pnpm check` — format, lint, typecheck, 531 unit, 121 component,
      configuration checks, and production build passed
- [x] `pnpm test:integration` — 26 files / 139 tests passed
- [x] `pnpm test:e2e` — Chromium 35/35 passed
- [x] `pnpm security:check` — no high/critical finding; 356 licenses approved
- [x] `pnpm backup:rehearse` — passed, RTO 5 seconds, Slides reconciled
- [x] Acceptance criteria mapped to migration unit/integration, repository
      integration, Chromium E2E, and backup rehearsal evidence
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, migration guards, integration/E2E/security/backup
  verification, and documentation.
- Remaining: PR exact-head CI.
- Blocker: none.
- Resume with: inspect migration exactness and Slide repository integration
  tests.

## Result

The guarded forward migration removes `slides.body` only after confirming the
document migration, replaces the text/image constraint, and removes the legacy
rollback trigger. Prisma and the repository now persist only `text_document`;
the existing API `body` is derived after strict parsing. All local canonical,
integration, E2E, security, database, and backup-rehearsal checks pass. The pull
request must still pass required exact-head CI before merge.
