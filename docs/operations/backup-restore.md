# Backup, restore, and logical recovery

## Scope and objectives

This workflow protects against operator error and logical database corruption while the single WebARENA Indigo VPS and its disk remain available.

- encrypted weekly archives are created every Monday and retained for 30 days;
- encrypted operational archives are created before deploys and imports and
  retained for 48 hours, but are not scheduled;
- scheduled backup freshness target (logical RPO) is seven days;
- isolated restore and approved promotion target (logical RTO) is 120 minutes;
- every restored database session is deleted before traffic can return.

VPS loss, disk loss, provider-wide loss, and Tokyo-region loss have no recovery objective. Archives are stored on the same VPS and are not disaster recovery. WebARENA operational backups are not user restore points.

## Encryption and access boundary

Archives use OpenSSL CMS AuthEnvelopedData with AES-256-GCM and an RSA 3072-bit recipient certificate; the content key is wrapped with RSA-OAEP. Generate the certificate and encrypted private key on an operator-controlled machine. Copy only the public certificate to `/etc/levi/backup-recipient.crt` on the VPS. Keep the private key offline; place it temporarily on the VPS with `600 root:root` only during an immediately approved restore, then remove it through the operator's secure process.

```bash
openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 \
  -subj '/CN=Levi PostgreSQL backup/' \
  -keyout levi-backup-private.pem \
  -out levi-backup-recipient.crt
```

The application container does not mount `/var/backups/levi`. The backup root and all archives are `700`/`600` and owned by root. The application identity therefore cannot read, modify, or delete archives. Root access remains able to do so, which is an accepted limitation of an on-host backup.

PostgreSQL initialization also separates `levi_admin` from `levi_app`. Compose injects only `DATABASE_URL` for `levi_app` into the application. Migrations, backup, restore, and promotion use the admin identity through an operator-only environment file; the application never receives that URL or password.

Do not commit either certificate or key. Do not paste archive content, private keys, database text, or credentials into Issues, logs, or CI artifacts.

## Installation

Install the checked-in scripts and systemd units below `/opt/levi`, then create the protected configuration.

```bash
sudo install -d -m 700 -o root -g root /var/backups/levi
sudo install -m 600 -o root -g root \
  deploy/production/backup.env.example /etc/levi/backup.env
sudo install -m 644 -o root -g root \
  levi-backup-recipient.crt /etc/levi/backup-recipient.crt
sudo install -m 644 -o root -g root \
  deploy/production/systemd/levi-backup-* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now \
  levi-backup-weekly.timer \
  levi-backup-health.timer
```

When updating a host that still has former hourly or daily timers installed,
stop the old schedules before enabling the weekly timer. This changes the
production backup schedule and allows legacy hourly archives older than 48
hours and legacy daily archives older than 30 days to be pruned by the next
backup run, so obtain immediate production approval first.

```bash
sudo systemctl disable --now levi-backup-hourly.timer
sudo systemctl disable --now levi-backup-daily.timer
sudo rm -f \
  /etc/systemd/system/levi-backup-hourly.service \
  /etc/systemd/system/levi-backup-hourly.timer \
  /etc/systemd/system/levi-backup-daily.service \
  /etc/systemd/system/levi-backup-daily.timer
sudo install -m 644 -o root -g root \
  deploy/production/systemd/levi-backup-weekly.service \
  deploy/production/systemd/levi-backup-weekly.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now levi-backup-weekly.timer
sudo systemctl list-timers 'levi-backup-*'
```

New scheduled archives are written below `weekly/`; deploy and import safety
points are written below `operational/`. Existing `hourly/` and `daily/`
archives remain accepted restore inputs and age out at their 48-hour and 30-day
retention boundaries; the transition does not relabel or rewrite an encrypted
archive.

Before enabling timers, confirm `/etc/levi/backup.env` points to the intended Compose file, production environment file, backup root, and public certificate. `production-backup.sh` uses a single-writer lock, validates the custom-format dump, records an anonymous reconciliation signature, encrypts atomically, writes a SHA-256 sidecar, prunes retention, and fails if backup filesystem use reaches 80%.

The health timer fails when no weekly archive is newer than eight days, storage reaches the limit, or no isolated restore proof is newer than 90 days. The eight-day detection threshold allows timer jitter and operational response without changing the seven-day scheduled objective. Issue #87 connects these systemd failures to the operational alert path.

```bash
sudo systemctl list-timers 'levi-backup-*'
sudo systemctl status levi-backup-weekly.service
sudo journalctl -u levi-backup-weekly.service --since '8 days ago'
sudo /opt/levi/scripts/check-production-backups.sh
```

## Local disposable rehearsal

`pnpm backup:rehearse` creates uniquely named local disposable source/restore databases, synthetic church and administrator sessions and Slide/Bible/bookmark fixtures, and an ephemeral RSA certificate. It creates operational and weekly archives, restores and reconciles them, proves both session types are invalidated, and reports elapsed RTO. It also verifies Slide expansion, deletion replay, invalid-fingerprint rejection and v1 archive compatibility. See the [Slide rollout/recovery checklist](../migration/slide-rollout-recovery.md). Temporary archives, key material, and the isolated database are removed on exit.

```bash
pnpm backup:rehearse
```

Run this before first release and at least quarterly. Success is restore evidence; a successful backup job by itself is not.

## Production isolated restore

A production restore is a high-impact action. Before copying the private key or running a command, record the exact archive, target, incident impact, expected loss window, forward-recovery/rollback choice, and receive immediate human approval under the governance policy.

Confirm the encrypted archive's checksum and temporarily install the approved private key as `600 root:root`. Do not pass a private-key value in the shell command or environment—only its filesystem path.

```bash
sudo LEVI_BACKUP_PRIVATE_KEY=/etc/levi/temporary-backup-private.pem \
  /opt/levi/scripts/production-restore.sh \
  /var/backups/levi/weekly/levi-weekly-YYYYMMDDTHHMMSSZ.tar.cms
```

The script decrypts into a root-only temporary directory, restores to a new `levi_restore_*` database, compares the stored critical-table/Bible signature (and Slide fingerprint for v2 archives), deletes every restored church and administrator session, verifies zero sessions, and records RPO/RTO evidence. It does not stop the application, rename the live database, or switch traffic. If verification fails, it drops the isolated database and leaves production untouched.

Check account and membership state against the incident recovery point. If the backup predates an account creation, password change/reset, or temporary-password consumption, identify affected account IDs without exposing credentials and remediate them through the operator UI.

## Approved promotion and rollback

Before promotion, complete the [Slide deletion reconciliation](../migration/slide-rollout-recovery.md#backup-and-deletion-boundary), including church/identity changes since the recovery point. Hard deletion does not purge older archives. Missing deletion evidence blocks promotion; do not silently revive content.

Promotion requires a second, immediate approval comment whose URL names the already verified restore database. Set that exact URL and database name only for the command invocation.

```bash
sudo \
  LEVI_RESTORE_DATABASE=levi_restore_yyyymmddthhmmssz \
  LEVI_RESTORE_APPROVAL_REFERENCE='https://github.com/iwaseasahi/levi/issues/NN#issuecomment-NN' \
  /opt/levi/scripts/production-promote-restore.sh
```

The script refuses unverified naming or a non-Levi approval URL, rechecks that the restore has zero sessions, stops Caddy and the application, retains the old database as `levi_rollback_*`, renames the verified database to `levi`, deletes sessions again, and waits for application readiness. Keep the rollback database until the post-restore checks and a full Sunday use cycle succeed.

If promotion does not become ready, do not improvise or delete either database. Keep traffic stopped, capture `docker compose ps` and non-sensitive logs, obtain a new approval, rename the failed `levi` aside, rename the printed `levi_rollback_*` database back to `levi`, delete sessions, and start the application. Every user must sign in again after either promotion or rollback.
