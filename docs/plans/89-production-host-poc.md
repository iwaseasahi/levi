# Issue #89: production host disposable PoC

## Outcome

Verify the selected WebARENA 4 vCPU / 4 GB host with the exact immutable
application and migration artifacts before any production credential or Bible
dump reaches the VPS.

## Safety boundary

- Use only synthetic, disposable PostgreSQL data.
- Use a Compose project and volumes separate from `levi-production`.
- Do not start Caddy, change DNS, issue a certificate, or expose a new public
  port.
- Require both remote images by immutable SHA-256 digest. A mutable tag is not
  accepted by the rehearsal command.
- Remove the rehearsal containers, networks, and volumes on success or failure.
- Never print generated passwords, authentication secrets, backup private keys,
  session tokens, or Bible text in the report or Issue.

## Execution order

1. Pull the approved application and migration digests from the VPS.
2. Start only the isolated PostgreSQL service and wait for its health check.
3. Apply the schema with the approved migration image.
4. Start the application only after migration and verify readiness.
5. Verify the application UID, read-only root filesystem, writable `/tmp`, and
   the non-elevated `levi_app` PostgreSQL role.
6. With `LEVI_RUN_SYNTHETIC_WORKLOAD=true`, add two synthetic churches and the
   minimum synthetic scripture catalog, then measure login, search, audience,
   folder, and bookmark operations under two-account concurrency. The report
   contains only anonymous counts, error count, latency percentiles, and DB
   connection count.
7. Measure encrypted backup and isolated restore RPO/RTO and prove restored
   sessions are removed.
8. Record only anonymous counts, timings, resource measurements, commit, and
   image digests in Issue #89 before deleting every PoC resource.

## Command

Run from the exact checked-out commit on the VPS. The values are public image
references, not credentials.

```bash
sudo \
  LEVI_RUN_SYNTHETIC_WORKLOAD=true \
  LEVI_RUN_BACKUP_RESTORE=true \
  LEVI_IMAGE='ghcr.io/iwaseasahi/levi@sha256:<application-digest>' \
  LEVI_MIGRATION_IMAGE='ghcr.io/iwaseasahi/levi-migrate@sha256:<migration-digest>' \
  ./scripts/rehearse-production-compose.sh
```

Without both variables the script retains its local development behavior and
builds disposable images. If either remote value is a tag rather than a digest,
it fails before starting a container.

## Evidence checklist

- [ ] exact commit and both immutable digests
- [ ] remote image pull from the VPS
- [ ] migration before application startup
- [ ] readiness and container hardening
- [ ] two synthetic church workflows and tenant isolation
- [ ] latency, error rate, CPU, memory, disk, and DB connections
- [ ] encrypted backup, isolated restore, zero restored sessions, measured RPO/RTO
- [ ] PoC container, network, volume, and temporary-secret cleanup
