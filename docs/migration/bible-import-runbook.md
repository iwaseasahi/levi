# Ginmaku Bible import runbook

This runbook prepares an import but does not authorize or execute a production
change. Production database access, translation provenance approval, backup,
execution, and rollback/forward-recovery approval remain human gates.

## Safety contract

- Input is decoded as strict UTF-8 and must declare `utf8` /
  `utf8_unicode_ci`.
- `validate` parses without a database. It rejects NULL, unknown mappings,
  invalid coordinates, duplicate locations, and verse gaps.
- Empty text and verse zero are valid and preserved byte-for-value after MySQL
  escape decoding. No trimming, repair, renumbering, or skip occurs.
- Output contains only counts and SHA-256 fingerprints. Errors expose stable
  reason codes and optional counts, never text or names.
- `dry-run` performs target and rights checks without writing.
- `import` requires the operator to repeat the exact source SHA-256. It uses
  batches of 500 rows by default inside one Serializable transaction. Any
  failure rolls back books, names, and verses together.
- A retry is a no-op only when metadata, locations, and content fingerprints all
  match. Partial or different target content fails closed.
- `reconcile` exits 0 only for an exact match and exits 2 for a mismatch.

## Prepared sequence

Use an absolute path controlled by the authorized operator; never copy the dump
into the repository.

```bash
pnpm migration:bible validate /approved/path/ginmaku.sql
pnpm migration:bible dry-run /approved/path/ginmaku.sql
pnpm migration:bible import /approved/path/ginmaku.sql \
  --confirm-source-sha <sha256-from-validate> --batch-size 500
pnpm migration:bible reconcile /approved/path/ginmaku.sql
```

Before production import, record the target/environment, backup and restore
test, exact checksum, expected anonymous counts/fingerprints, translation
`APPROVED` provenance metadata, human approval, maintenance/locking window, and
post-import reconciliation. Do not bypass `IMPORT_TRANSLATION_RIGHTS_NOT_APPROVED`.

## Failure recovery

An import error leaves no partial catalog because all batches share one
transaction. Preserve the anonymous error code, correct the source/metadata or
restore the target as approved, rerun `dry-run`, and then restart from the first
batch. Never delete or overwrite mismatching target rows through this CLI.

The synthetic integration rehearsal covers initial import, before/after
reconciliation, exact retry, content mismatch, duplicate, gap, invalid UTF-8,
empty/newline/verse-zero preservation, and injected mid-batch rollback.
