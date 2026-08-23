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
- `dry-run` performs target metadata and exactness checks without writing.
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

## Disposable rehearsal

Before requesting a production change, run the complete workflow against the
fixed local Compose databases. The command rejects non-local hosts, unexpected
ports, usernames other than `levi`, and database names without the
`_rehearsal` suffix. It creates and removes only
`levi_bible_migration_rehearsal` and `levi_bible_restore_rehearsal`.

```bash
pnpm db:up
pnpm migration:bible:rehearse /approved/path/ginmaku.sql \
  > /operator-controlled/rehearsal-report.json
```

The report is text-free and records the source/tool/schema versions, anonymous
source and target counts, validation results, aggregate and deterministic
sample fingerprints, an injected mid-import failure and rollback, exact retry,
backup archive fingerprint, restored counts, and restored reconciliation. Keep
the source dump and full transient report outside the repository. Commit only a
reviewed anonymous summary and the report SHA-256.

Before production import, record the target/environment, backup and restore
test, exact checksum, expected anonymous counts/fingerprints, translation
provenance metadata, human approval, maintenance/locking window, and post-import
reconciliation.

Production import requires a human to approve all of the following immediately
before execution: the exact source SHA-256, translation rights metadata, target
database identity, fresh backup and successful restore rehearsal, maintenance
window, execution operator, rollback/forward-recovery choice, and post-import
reconciliation owner. The rehearsal report's `productionExecuted: false` must
never be treated as cutover approval.

## Failure recovery

An import error leaves no partial catalog because all batches share one
transaction. Preserve the anonymous error code, correct the source/metadata or
restore the target as approved, rerun `dry-run`, and then restart from the first
batch. Never delete or overwrite mismatching target rows through this CLI.

If a production import fails before commit, retain the stable error code, prove
that the target still matches its pre-import anonymous signature, correct the
cause, rerun `dry-run`, and restart from the first batch. If reconciliation
fails after a committed change, stop reads from the affected catalog and have
the approved human choose either restoration of the verified pre-import backup
or a separately reviewed forward fix. Reconcile the chosen recovery against
the approved source before reopening access.

The synthetic integration rehearsal covers initial import, before/after
reconciliation, exact retry, content mismatch, duplicate, gap, invalid UTF-8,
empty/newline/verse-zero preservation, injected mid-batch rollback, backup
restore, and post-restore exact/sample-fingerprint reconciliation.
