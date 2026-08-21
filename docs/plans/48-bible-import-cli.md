# Idempotent Bible import and reconciliation CLI

## Issue

- Issue: #48
- Branch: `codex/issue-48`
- Base commit: `1097f49`

## Outcome

An operator can validate or dry-run a Ginmaku SQL dump, import it atomically
into a disposable or approved Levi database, and reconcile anonymous evidence.
Retries never silently duplicate, replace, normalize, or omit source rows.

## Context

- ADR 0007 and Issue #47 define the normalized catalog and approved mapping.
- The approved profile contains 62,325 rows, five empty strings, and 116
  verse-zero locations; every value must be preserved.
- Production import remains outside this Issue and requires immediate human
  approval.

## Constraints

- Never log or persist Bible text, book names, the dump, or secrets.
- Fail closed before writing on schema, mapping, content, or rights mismatch.
- Use one database transaction; batch statements reduce query size but do not
  create partial commits.

## Non-goals

- Running an import against production.
- Repairing, trimming, renumbering, or otherwise changing `books` values.
- Activating translation rights without complete provenance metadata.

## Plan

1. [x] Extract a reusable fail-closed dump parser and validation contract.
2. [x] Implement validate, dry-run, import, and reconcile CLI modes with
       anonymous JSON evidence and explicit batch/transaction behavior.
3. [x] Add synthetic rehearsals for success, empty/zero preservation,
       duplicate, gap, encoding failure, rollback, mismatch, and idempotency.
4. [x] Document operator procedure, recovery, checksums, and approval boundary;
       update migration parity evidence.
5. [x] Run all local and exact-commit CI gates, then merge.

## Progress

- 2026-08-21 16:40 JST — Started from merged Issue #47 evidence; acquired the
  Issue #48 single-writer lease and confirmed production execution is excluded.
- 2026-08-21 16:52 JST — Implemented four CLI modes, anonymous full-catalog
  fingerprints, single-transaction batched import, and fail-closed retry. The
  43-test PostgreSQL suite passes, including rollback and exact preservation.
- 2026-08-21 16:53 JST — The approved production dump passes read-only
  `validate` at 62,325 rows, five empty texts, and 116 verse-zero rows. Its
  `dry-run` stops before writes with `IMPORT_TRANSLATION_RIGHTS_NOT_APPROVED`, as
  required while provenance metadata remains `PENDING`.

## Decisions

- 2026-08-21 — Import is one serializable transaction with bounded batches.
  - Reason: exact all-or-nothing preservation is more important than exposing
    resumable partial state for this 62k-row catalog.
- 2026-08-21 — Keep parser, CLI, runbook, and synthetic rehearsal in one PR.
  - Reason: they form one fail-closed data boundary and share one rollback and
    confidentiality review; merging the importer without its executable safety
    tests or the parser without its consumer would not deliver an independent
    product outcome.
  - Alternative: land parser extraction separately; rejected because it only
    moves existing behavior and would not independently satisfy Issue #48.
  - Alternative: commit each batch and persist a resume cursor; rejected because
    it creates a partial catalog and more recovery states.

## Risks and mitigations

- Risk: retry changes already imported content.
  - Mitigation: compare anonymous location/content fingerprints; exact matches
    are no-ops and any difference fails before mutation.
- Risk: an error leaks licensed text.
  - Mitigation: errors contain only reason codes and location fingerprints.
- Risk: a mid-import failure leaves partial data.
  - Mitigation: fault-injection integration test proves transaction rollback.

## Verification

- [x] `pnpm test:unit` — 52 passed
- [x] `pnpm test:integration` — 43 passed
- [x] synthetic before/import/after/retry rehearsal
- [x] `pnpm db:check`
- [x] `pnpm check` — 52 unit, 10 component, production build
- [x] `pnpm security:check` — audit and 314 approved licenses
- [x] `git diff --check`
- [x] final diff reviewed for production data and unsafe defaults

## Handoff or blockers

- Completed: implementation, rehearsal, documentation, and production-safe
  read-only validation.
- Remaining: exact-commit CI and merge.
- Blocker: none.
- Resume with: run the complete local quality and security gates.

## Result

The implementation and local rehearsal are complete. Production remains
untouched and blocked by the documented approval/provenance gates. Exact-commit
GitHub Quality, Database, E2E, and Security verification passed on PR #71; the
recorded completion commit is verified again before merge.
