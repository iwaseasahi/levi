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

ADR 0005 selects one WebARENA Indigo 4 GB VPS in Tokyo. Issue #86 must prove
encryption and key ownership, access/audit policy, retention/deletion, restore
environment, storage limits, and operational ownership. The release-entry
objectives are RPO no greater than 60 minutes and RTO no greater than 120
minutes for logical error while that VPS and disk remain available. Hourly
on-host archives are retained for 48 hours and daily archives for 14 days; the
application identity must not be able to modify or delete them.

VPS loss, disk loss, provider-wide loss, and Tokyo-region loss have no recovery
objective. On-host archives are not disaster recovery and provider operational
backups are not user restore points. This accepted limitation must be visible in
release and incident decisions.

Complete an isolated restore before first release and at least quarterly. Alert
when the newest usable recovery point is older than 60 minutes or the newest
successful restore proof is older than 90 days. A production restore requires
the exact backup, target, impact, loss window, rollback/forward-recovery choice,
and immediate human approval defined by governance. The selected VPS has no
managed PITR; Issue #86 must implement and measure the archive workflow rather
than implying provider recovery.

Disaster recovery succeeds only when a clean environment can restore an approved
backup within RTO, reconcile data to the expected recovery point, pass migration
status/readiness and critical E2E, and record timings/evidence without exposing
Restricted data. “Backup job succeeded” alone is not restore evidence.

Before restored traffic returns, invalidate every restored database session and
verify platform-operator and Church membership state. If the recovery point
predates an account creation, password change/reset, or temporary-password
consumption, identify the affected accounts without exposing credentials and
have the platform operator remediate them through the UI. See the
[`initial-release-cutover.md`](initial-release-cutover.md) runbook for the exact
cutover and recovery gates.
