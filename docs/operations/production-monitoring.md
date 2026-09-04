# Production monitoring, logs, and incident routing

## Signals and thresholds

`levi-health.timer` runs every minute on the VPS and fails closed when any signal is unhealthy:

- public `/api/ready` is not HTTP 200 with `status=ready` within 10 seconds;
- PostgreSQL `pg_isready` fails;
- no encrypted weekly backup is newer than eight days;
- the newest isolated restore proof is older than 90 days;
- root disk or backup filesystem use reaches 80%;
- any church's Slide image bytes reach 80% of its configured quota;
- host memory use reaches 90%;
- Caddy records at least five 5xx responses in five minutes.

GitHub's `Production smoke` workflow checks public readiness at minute zero of
every hour when `PRODUCTION_BASE_URL` is configured. This is a low-cost
supplementary external check; scheduled Actions may be delayed and are not an
SLA. A failed workflow posts a fixed, non-sensitive message and the Actions run
URL to Slack when `SLACK_MONITORING_WEBHOOK_URL` is configured. The VPS-side
timer remains the source for DB, capacity, backup, and 5xx signals.

The VPS-side check remains every minute. `run-production-health-monitor.sh`
records only whether an incident is active in `/var/lib/levi-monitoring`. It
posts one Slack message on the first failed check, suppresses repeated alerts
while the failure continues, and posts one recovery message after the first
successful check. The message never contains check output, request data, or a
secret. When no webhook is configured, health checks and their systemd result
continue to work without Slack.

`SLIDE_IMAGE_BYTES_PER_CHURCH` is read from the protected production environment
and is the hard transactional write limit. `LEVI_SLIDE_IMAGE_CAPACITY_PERCENT`
in `monitoring.env` defaults to 80 and is the earlier warning threshold. Health
output reports only the maximum percentage across churches, never church IDs,
titles, image metadata, checksums, or bytes. The operator must approve the exact
production quota before deploying the image migration/application.

Every successful minute also records `slide_image_table_bytes`, total
`database_bytes`, and the newest `weekly_backup_bytes` in the bounded system
journal. Compare these aggregate samples to assess 14-day growth without
querying church content. The hard alerts remain the 80% per-church quota,
root-disk, and backup-filesystem thresholds; abnormal growth below those limits
requires an operations Issue and quota/S3 review under ADR 0016.

## Slack alert setup

Use a dedicated private Slack channel for Levi production operations. Create a
Slack app, enable Incoming Webhooks, and add a webhook to that channel following
[Slack's Incoming Webhooks documentation](https://api.slack.com/messaging/webhooks).
The generated URL is a secret tied to that channel. Do not paste it into an
Issue, PR, chat, terminal output, or repository file.

Store the same URL in these two protected locations:

1. GitHub repository Actions secret `SLACK_MONITORING_WEBHOOK_URL`, used only by
   the hourly external readiness workflow.
2. Root-owned `/etc/levi/monitoring.env` as `LEVI_SLACK_WEBHOOK_URL`, used only by
   the VPS-side transition notifier.

For GitHub, enter the value in **Settings > Secrets and variables > Actions >
New repository secret**. For the VPS, edit the protected file without printing
its contents and retain mode `600 root:root`. Creating either secret and changing
the running production service require the operator's explicit approval.

After both values are installed in an approved maintenance window, install the
updated script and unit, reload systemd, then run one controlled notification
test. Do not simulate a real outage by stopping production. Instead, use a
separately reviewed test entrypoint that sends a fixed test message and confirm
the expected channel receives exactly one event.

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

Useful non-secret diagnostics are:

```bash
sudo systemctl list-timers levi-health.timer
sudo systemctl show --property=Result --value levi-health.service
sudo test -f /var/lib/levi-monitoring/health-failed \
  && echo incident-active \
  || echo healthy
```

Do not print `/etc/levi/monitoring.env` or include its contents in diagnostic
output.

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

If the VPS cannot send any signal, the next hourly external readiness run fails
and Slack receives the external alert. A fully stopped VPS cannot send an
internal recovery message; the hourly workflow will become successful again but
does not currently send an external recovery notification. If GitHub monitoring
or Slack is also unavailable, church contacts report projection failure to the
Levi operator using the separately maintained contact channel. Personal contact
details do not belong in the repository.

## Incident minimum record

Record detection time, reporter, affected churches, current commit/digests, readiness/DB/5xx/capacity/backup evidence, last known good time, data-integrity assessment, decision and approver, communication times, recovery action, verification, and follow-up Issues. Do not paste Restricted or Confidential data.

## Production renewal register

The operator owns this register. Review it quarterly and after changing a
provider, certificate, key, or credential. Keep provider account identifiers,
billing details, secret values, recovery codes, IP addresses, and private-key
material outside the repository.

| Item                                    | Current policy or expiry                                                                            | Review or action deadline                                                                                           | Evidence location                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `levi-system.com` registration          | XServer automatic renewal is enabled; current term ends 2028-08-25                                  | Confirm billing and registrant contact by 2028-05-27, then at least 90 days before every later expiry               | XServer Domain console                                                      |
| WebARENA production VPS                 | Continuously billed service; no repository-managed expiry                                           | Confirm payment method, instance state, and console recovery access quarterly; next review 2026-11-26               | WebARENA console                                                            |
| Public TLS certificates                 | Caddy automatic issuance and renewal with persistent certificate storage                            | External domain verification must always show at least 30 days remaining; investigate any renewal error immediately | Caddy data volume and `production:domain:verify`                            |
| PostgreSQL backup recipient certificate | Public certificate expires 2036-08-22; encrypted private key remains offline                        | Replace and prove backup/isolated restore by 2036-05-24                                                             | Operator recovery storage and `/etc/levi/backup-recipient.crt`              |
| Encrypted database backups              | Monday weekly schedule; each archive retained for 30 days; isolated restore proof valid for 90 days | Health timer checks continuously; perform and record a new isolated restore at least every 90 days                  | `/var/backups/levi` and restore proof                                       |
| Runtime and database credentials        | Rotate immediately after suspected exposure or operator-access change                               | Annual review by 2027-08-26 if no earlier event requires rotation                                                   | Protected production environment; values are never copied to the repository |
| Admin Basic authentication credential   | Rotate immediately after suspected exposure or administrator change                                 | Annual review by 2027-08-26 if no earlier event requires rotation                                                   | Protected production environment                                            |
| Production SSH key                      | Levi-only operator key; revoke immediately after loss or access change                              | Annual review by 2027-08-26 if no earlier event requires rotation                                                   | Operator-controlled SSH storage and VPS `authorized_keys`                   |

When a date or policy changes, update this table through a reviewed pull request
and record the provider-side confirmation in the operations Issue without
copying sensitive evidence.

## Initial production baseline

The first post-launch baseline was measured on 2026-08-26 JST and recorded in
GitHub Issue #280:

- public readiness returned HTTP 200 with PostgreSQL `ok`;
- root disk use was 14% against the 80% threshold;
- host memory use was 15% against the 90% threshold;
- Caddy recorded zero 5xx responses in the final five-minute window;
- the weekly backup and isolated restore proof passed health checks;
- `levi-health.timer`, `levi-backup-health.timer`, and
  `levi-backup-weekly.timer` were enabled and active;
- a controlled VPS reboot restored SSH, Docker, HTTPS, application readiness,
  PostgreSQL, and all three timers without manual service recovery;
- the first health run during application startup failed closed, and a later
  timer run recovered automatically with a successful result;
- 93 sensitive Caddy header fields were present only with redacted values, and
  no unredacted application credential, database URL, session token, password,
  or private-key value was found.

This is an operational baseline, not an SLA. Record the first real Sunday-use
CPU, memory, disk, latency, and error measurements separately because synthetic
or idle measurements do not represent projection traffic.
