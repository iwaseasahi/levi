# Production monitoring, logs, and incident routing

## Signals and thresholds

`levi-health.timer` runs every minute on the VPS and fails closed when any signal is unhealthy:

- public `/api/ready` is not HTTP 200 with `status=ready` within 10 seconds;
- PostgreSQL `pg_isready` fails;
- no encrypted weekly backup is newer than eight days;
- the newest isolated restore proof is older than 90 days;
- root disk or backup filesystem use reaches 80%;
- host memory use reaches 90%;
- Caddy records at least five 5xx responses in five minutes.

GitHub's `Production smoke` workflow checks public readiness every 15 minutes when `PRODUCTION_BASE_URL` is configured. This is a low-cost supplementary external check; scheduled Actions may be delayed and are not an SLA. A failed workflow uses GitHub's normal Actions notification route. The VPS-side timer remains the source for DB, capacity, backup, and 5xx signals.

Install `/etc/levi/monitoring.env` from the example, install and enable the service/timer, and check the first result before release:

```bash
sudo install -m 600 -o root -g root \
  deploy/production/monitoring.env.example /etc/levi/monitoring.env
sudo install -m 644 -o root -g root \
  deploy/production/systemd/levi-health.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now levi-health.timer
sudo systemctl start levi-health.service
sudo systemctl status levi-health.service
```

Install the bounded journal retention configuration during the same approved provisioning window:

```bash
sudo install -d -m 755 /etc/systemd/journald.conf.d
sudo install -m 644 -o root -g root \
  deploy/production/journald-levi.conf \
  /etc/systemd/journald.conf.d/90-levi-retention.conf
sudo systemctl restart systemd-journald
```

## Log rotation, retention, and redaction

Compose uses Docker's `json-file` rotation with three 10 MB files per container. Install `journald-levi.conf` as `/etc/systemd/journald.conf.d/90-levi-retention.conf`; journald is compressed, capped at 200 MB, and retained for at most 14 days. Backup archives and restore proofs follow their separate retention policy and are not logs.

Application logs remain structured and must not contain passwords, session tokens, cookies, authorization headers, database URLs, private keys, full request/response bodies, or Bible text. Caddy access logs do not add authentication headers; operators must never place secrets in URLs or query strings. Before attaching logs to an Issue, search for and remove email addresses, IP addresses, cookies, tokens, credentials, and scripture content. Report request IDs, event names, status, counts, commit/digest, and UTC times instead.

## Routing and ownership

- Primary incident owner: Levi platform operator. Acknowledges alerts, opens the incident Issue, chooses rollback/forward recovery, and performs approved production actions.
- Service communication owner: the designated contact for each church. Receives impact, workaround, and recovery updates; never receives credentials or raw logs.
- Sunday target: acknowledge within 15 minutes when GitHub/VPS alerts are visible, notify affected church contacts within 30 minutes, and update at least every 30 minutes until stable.
- Weekday target: acknowledge within four hours. Low-traffic non-impacting warnings may be handled in the next maintenance window.

If the VPS cannot send any signal, external readiness fails and routes through GitHub Actions. If GitHub monitoring is also unavailable, church contacts report projection failure to the Levi operator using the separately maintained contact channel. Personal contact details do not belong in the repository.

## Incident minimum record

Record detection time, reporter, affected churches, current commit/digests, readiness/DB/5xx/capacity/backup evidence, last known good time, data-integrity assessment, decision and approver, communication times, recovery action, verification, and follow-up Issues. Do not paste Restricted or Confidential data.
