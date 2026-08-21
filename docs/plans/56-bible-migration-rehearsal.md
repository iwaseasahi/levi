# Production-shaped Bible migration rehearsal

## Issue

- Issue: #56
- Branch: `codex/issue-56`
- Base commit: `79bc586`

## Outcome

The approved local Ginmaku dump can be repeatedly rehearsed against disposable
PostgreSQL databases, producing content-free evidence for validation, clean
import, rollback after an injected failure, idempotent retry, backup restore,
and exact post-restore reconciliation.

## Context

- Issue #47 recorded the approved source SHA-256 and anonymous 62,325-row
  profile without retaining text.
- Issue #48 implemented strict validation and a single-transaction importer.
- The product owner authorized Bible display, version 2 → NKJV, preservation of
  five empty texts and all source `books` rows, and use of Bible text in tests.
- The approved source remains outside the repository at a product-owner
  controlled absolute path.

## Constraints

- Never copy the dump or Bible text into the repository, logs, report, fixture,
  screenshot, trace, or artifact.
- Destructive setup/cleanup is allowed only for exact database names ending in
  `_rehearsal` on the local Compose PostgreSQL service.
- Production execution, credentials, translation provenance activation,
  cutover, and production rollback remain immediate human approval gates.
- Preserve empty text, verse zero, book names, locations, encoding, and newline
  values exactly.

## Non-goals

- Importing or modifying a production database.
- Repairing, trimming, renumbering, or publishing Bible content.
- Selecting a production backup provider, RPO/RTO, or release time (Issue #58).

## Plan

1. [x] Extend anonymous source evidence with chapter/newline/pair and explicit
       validation-result counts while keeping all text fingerprint-only.
2. [x] Add a guarded disposable-DB rehearsal runner for failed transaction,
       clean import, exact rerun, reconciliation, backup restore, and restored
       reconciliation.
3. [x] Run the approved dump locally and commit only the anonymous versioned
       reconciliation summary plus its evidence SHA-256.
4. [x] Extend synthetic integration/backup tests and document production human
       gates, rollback, and forward recovery.
5. [ ] Pass all exact-commit CI gates, then merge.

## Progress

- 2026-08-21 19:48 JST — Started automatically after Issue #55 merged; verified
  the approved 36 MB local source remains outside the repository, read the
  importer/runbook/evidence/backup contracts, and acquired the writer lease.
- 2026-08-21 19:57 JST — Passed the synthetic 72-test integration suite on a
  clean disposable database, including rollback, retry, backup, restore, and
  content-free report assertions.
- 2026-08-21 19:58 JST — Rehearsed the approved 37,585,883-byte dump locally:
  62,325 verses imported, five empty texts and 116 verse-zero rows preserved,
  retry unchanged, and restored reconciliation exact. Production was not used.
- 2026-08-21 20:02 JST — Passed local formatting, lint, typecheck, 138 unit,
  23 component, 72 integration, 10 E2E, production build, schema-diff, backup
  restore, dependency audit, and license checks.

## Decisions

- 2026-08-21 — Decision: use fixed disposable database names and fail closed on
  any other target.
  - Reason: rehearsal requires destructive reset/restore but must be structurally
    incapable of targeting production by configuration accident.
- 2026-08-21 — Decision: emit only counts, versions, durations, and SHA-256
  fingerprints.
  - Reason: exact equality is verifiable without exposing licensed text.

## Risks and mitigations

- Risk: rehearsal cleanup targets the wrong database.
  - Mitigation: parse the URL, require localhost Compose port and an exact
    `_rehearsal` suffix, and resolve explicit database names before drop/create.
- Risk: a failed batch leaves partial rows.
  - Mitigation: inject failure after a batch and assert before-count equality
    before the clean run.
- Risk: a successful backup cannot restore usable Bible data.
  - Mitigation: restore to a second disposable database and run the same full
    reconciliation against it.

## Verification

- [x] approved dump validate/rehearse report contains no source text
- [x] clean/rerun/failure/restore reconciliation exact
- [x] `pnpm backup:rehearse`
- [x] `pnpm check`, `pnpm test:integration`, `pnpm security:check`
- [x] `pnpm db:schema:check`, `pnpm test:e2e`
- [ ] exact-head `Quality`, `Database`, `E2E`, `Security`

## Handoff or blockers

- Completed: intake, source existence/fingerprint provenance review, plan.
- Remaining: evidence extension, runner, approved rehearsal, tests/docs, CI.
- Blocker: none for disposable rehearsal; production remains explicitly gated.
- Resume with: extend `SourceReport` without reading or printing individual text.
