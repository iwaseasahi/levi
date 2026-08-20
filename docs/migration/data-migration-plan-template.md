# Data migration plan: <slice>

## Scope and authority

- Matrix IDs:
- Source owner and approved access:
- Source snapshot identifier/hash:
- Data classification and content licensing:
- Target schema/migration:
- Explicit exclusions:

Production exports must never enter the repository, prompts, logs, screenshots,
or CI artifacts. Rehearsal uses hand-built synthetic fixtures by default. An
anonymized fixture requires documented approval and a transformation that removes
content, identifiers, credentials, free text, filenames, and linkable metadata
before it reaches an agent environment.

## Source schema

| Source table/field | Type/collation/timezone | Null/default | Key/relation | Delete semantics | Evidence |
| ------------------ | ----------------------- | ------------ | ------------ | ---------------- | -------- |
|                    |                         |              |              |                  |          |

## Mapping and transformation

| Source | Target | Rule | Invalid/ambiguous input | Stable ID mapping | Test fixture |
| ------ | ------ | ---- | ----------------------- | ----------------- | ------------ |
|        |        |      |                         |                   |              |

State Unicode normalization, byte/text encoding, line-ending and whitespace
rules, timezone interpretation, daylight-saving behavior, decimal/boolean
coercion, and whether source soft-deleted rows are retained.

## Rehearsal sequence

1. Provision an empty disposable PostgreSQL test database.
2. Apply all committed Levi migrations.
3. Load the versioned synthetic source fixture into isolated staging tables or a
   parser that cannot reach production.
4. Run the transformation twice and prove idempotency or an explicit safe
   resume/checkpoint behavior.
5. Run every reconciliation rule below and retain the non-sensitive report.
6. Exercise the migrated vertical slice through integration and E2E tests.
7. Test rollback or forward recovery on another disposable database.

## Reconciliation rules

| Dimension    | Required check                                                                         | Expected result                                                 |
| ------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Counts       | Per source/target entity: total, active, soft-deleted, accepted, rejected              | Target plus documented rejects equals source scope              |
| Foreign keys | Orphans, missing parents, invalid polymorphic targets                                  | Zero unexplained violations before target constraints           |
| Duplicates   | Natural-key and mapped-ID duplicate groups                                             | Zero, or every group resolved by an approved deterministic rule |
| Nulls        | Per-field null counts before/after, including empty-string/sentinel handling           | Matches mapping rule; no implicit coercion                      |
| Encoding     | Strict source decode, UTF-8 target encode, replacement-character and invalid-byte scan | Zero silent replacements; every rejection reported              |
| Timezone     | Parse source timezone explicitly, convert to UTC, round-trip boundary/DST cases        | Exact expected instant and documented precision                 |
| Content      | Stable hashes after documented EOL/Unicode normalization                               | All accepted text/PDF records reconcile                         |
| IDs          | One-to-one legacy-ID → Levi-UUID map and collision scan                                | Complete, unique mapping for accepted records                   |

Reports contain aggregate counts and synthetic record IDs only. A failed rule is
a failed migration rehearsal, never a warning to ignore.

## Failure, rollback, and recovery

- Pre-migration backup/restore proof:
- Point of no return:
- Rollback steps before that point:
- Forward-recovery steps after that point:
- Partial-run cleanup/resume behavior:
- Application compatibility window:
- Verification after recovery:
- Human approval required for production execution:

## Result

- Fixture version and hash:
- Commands and report artifacts:
- Reconciliation summary:
- Residual risks/blockers:
- Owner sign-off/decision reference:
