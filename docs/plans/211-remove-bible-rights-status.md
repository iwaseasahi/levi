# Remove the Bible rights status gate

## Issue

- Issue: #211
- Branch: `codex/issue-211`
- Base commit: `99d8f58`

## Outcome

Bible translations are available based on their catalog data alone. The
`BibleRightsStatus` enum, `rights_status` column, approval predicates, and import
approval gate no longer exist in the active schema or application.

## Context

- The product owner confirmed Bible display authorization and requested that
  `rightsStatus` be removed at this stage.
- The restored local catalog contains 62,325 verses and exactly matches the
  approved Ginmaku dump.
- `source_reference` and `rights_notice` remain optional provenance fields.

## Constraints

- Add a forward migration; never edit merged migrations.
- Preserve all Bible translations, books, names, verses, and provenance text.
- Preserve availability errors for genuinely missing translations or verses.
- Do not apply the migration to production.

## Non-goals

- Removing optional provenance fields.
- Changing Bible content, mapping, or search behavior.

## Plan

1. [x] Remove the enum/column with a forward migration and update generated
       Prisma types.
2. [x] Remove approval filters and gates from repositories and import workflow.
3. [x] Update seed, verification, fixtures, tests, and active documentation.
4. [ ] Rehearse on test DB and apply locally while proving catalog fingerprints
       and non-Bible counts are unchanged.
5. [ ] Run canonical checks and merge only after all required CI passes.

## Progress

- 2026-08-24 00:07 JST — Started from the merged test-DB safety change and
  inspected every active `rightsStatus` reference.
- 2026-08-24 00:10 JST — Added the forward migration and removed the state from
  Prisma, repositories, import, fixtures, verification, tests, and active docs.
- 2026-08-24 00:10 JST — Integration suite passed 77 tests after deploying all
  seven migrations to `levi_test`.
- 2026-08-24 00:11 JST — `mise run check` passed formatting, lint, typecheck,
  251 unit tests, 40 component tests, configuration checks, and build.
- 2026-08-24 00:12 JST — Full 62,325-verse migration rehearsal passed injected
  rollback, import, backup restore, and exact reconciliation; report SHA-256
  `45aade623c6984977b0f6e747dc14d77ef60d4b51001c1942964377f78c56d80`.

## Decisions

- 2026-08-24 — Decision: retain `source_reference` and `rights_notice` as
  optional descriptive provenance, but remove their coupling to availability.
  - Reason: the request removes the state gate, not useful source metadata.
  - Alternatives: dropping all three fields was rejected as unnecessary data
    loss.

## Risks and mitigations

- Risk: dropping a column takes an exclusive table lock.
  - Mitigation: the local/CI tables are tiny; production application is outside
    this task and requires a separately approved migration window.
- Risk: removal accidentally broadens beyond known JSS3/NKJV translations.
  - Mitigation: repositories still request explicit translation codes and tests
    retain missing-translation failures.

## Verification

- [x] `mise exec -- pnpm test:integration` — 77 tests passed.
- [x] `mise run check` — passed, including 251 unit and 40 component tests.
- [ ] `mise exec -- pnpm test:e2e`
- [ ] local pre/post catalog reconciliation and non-Bible counts
- [ ] Required CI checks on the exact PR head
- [ ] Final diff reviewed for data loss and stale active references

## Handoff or blockers

- Completed: implementation, test migration, integration/canonical checks, and
  full-corpus disposable rehearsal.
- Remaining: CI, merge, and local apply with pre/post evidence.
- Blocker: none.
- Resume with: commit, open the PR, and inspect required CI.

## Result

Pending.
