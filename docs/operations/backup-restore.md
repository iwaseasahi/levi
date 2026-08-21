# Backup, restore, and disaster recovery

`pnpm backup:rehearse` verifies the mechanics against the repository's local
Compose PostgreSQL only. It creates a custom-format dump of `levi`, restores it
to the explicitly named disposable database `levi_restore_rehearsal`, compares
an anonymous signature of critical row counts and ordered Bible content hashes,
prints a SHA-256 for the transient archive, then drops the rehearsal database
and removes the archive. Neither Bible text nor credentials are emitted.

## Local rehearsal

```bash
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm backup:rehearse
pnpm db:down
```

Success requires:

- `pg_dump` and `pg_restore --list` complete without error;
- restore into an empty disposable database completes with `--exit-on-error`;
- source and restored critical-table counts, completed migrations, and Bible
  content fingerprints match exactly;
- the archive never leaves the temporary directory and is removed;
- the source database is never dropped or mutated by the rehearsal.

The signature covers identity, tenant, Bible catalog, folder, and bookmark
tables. Continue extending it when new critical entities appear. Run the
rehearsal in a scheduled disposable environment in a later Issue; this baseline
does not grant cloud or production access.

## Production decision gate

Before production, humans must approve backup provider/location, encryption and
key ownership, access/audit policy, retention/deletion, immutable/offsite copy,
frequency, RPO, RTO, restore environment, and cost. A production restore drill
requires the exact backup, target, impact, rollback/forward recovery, and
immediate human approval defined by governance.

Disaster recovery succeeds only when a clean environment can restore an approved
backup within RTO, reconcile data to the expected recovery point, pass migration
status/readiness and critical E2E, and record timings/evidence without exposing
Restricted data. “Backup job succeeded” alone is not restore evidence.
