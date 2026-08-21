# Initial-release operations and cutover runbook

## Status and authority

This runbook is prepared and locally rehearsed; it is not production approval.
The candidate is a single cutover because the only retained Ginmaku data is the
static Bible catalog and Levi does not need a mutable dual-write period. The
product owner and operations owner must approve the strategy, target, window,
and every production action immediately before execution.

ADR 0005 selects WebARENA Indigo Linux 4 GB in Tokyo with Caddy, Levi, and
PostgreSQL 18 on one VPS. Issues #85–#89 still block production Compose,
hardening, backup/restore, deploy, monitoring, domain/TLS, capacity proof,
contracting, and credentials. No outbound email provider is part of the initial
release.

## Service objectives and backup requirements

The selected single-VPS implementation must prove these entry criteria before
traffic is enabled:

- recovery point objective (RPO): no more than 60 minutes of accepted mutable
  Levi data;
- recovery time objective (RTO): restore a clean environment, reconcile data,
  pass readiness and critical smoke checks, and make the go/no-go decision
  within 120 minutes;
- an encrypted on-host database archive at least hourly, retained for 48 hours,
  plus a daily archive retained for 14 days;
- archive ownership and permissions that prevent the application container from
  reading, modifying, or deleting backups;
- a successful restore into an isolated environment before first release and
  at least quarterly thereafter;
- alert when the newest usable recovery point exceeds 60 minutes or the newest
  successful restore proof exceeds 90 days.

These RPO/RTO objectives cover operator or application error only while the VPS
and disk remain available. ADR 0005 explicitly provides no objective for VPS,
disk, provider, or Tokyo-region loss. Issue #86 must identify encryption/key
ownership, audit access, storage limits, and the human authorized to restore.

## Roles required at the release gate

The release record must name one human for each role. One person may hold
multiple roles only when the product owner explicitly accepts that concentration
of responsibility.

| Role                           | Responsibility                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Go/no-go owner                 | Approves the exact target, source fingerprint, window, and traffic change.                 |
| Execution owner                | Runs only the reviewed provider-specific commands.                                         |
| Data verification owner        | Verifies backup restore, schema status, Bible reconciliation, and mutable-data signatures. |
| Application verification owner | Runs readiness and the critical Chrome smoke flow.                                         |
| Incident commander             | Owns stop, containment, rollback/forward-recovery choice, and update cadence.              |
| Communication owner            | Sends only the approved before/after/incident notices.                                     |

No role may be left as “Codex” or an unattended automation for a production
decision.

## Credential and recovery rules

- The Better Auth secret and database credentials live only in a root-owned
  server file with mode `0600`. They are not stored in database backups,
  repository files, images, Compose files, CI artifacts, Issues, or this
  runbook.
- Database backups contain password hashes, session records, account state, and
  temporary-password state and therefore use the Restricted data controls.
- A restore must fail closed by invalidating all restored sessions before
  traffic returns. Secret rotation is required only for suspected compromise
  or an explicitly approved rotation event; it is never an automatic agent
  action.
- If the recovery point predates a password reset/change or account creation,
  the operations owner identifies affected accounts and the platform operator
  reissues temporary credentials through the UI. Temporary values are shown
  once through the approved direct channel and never copied into incident
  evidence.
- The restored environment remains inaccessible to users until actor state,
  Church assignment, session invalidation, and credential ambiguity checks pass.

## Ordered cutover

The machine-checked order is defined in
[`config/initial-release-plan.json`](../../config/initial-release-plan.json).
Do not skip or reorder it.

1. Confirm Issue #81 is resolved, record all named owners, exact production
   target, commit/image identifier, approved source SHA-256, rights metadata,
   change ticket, and immediate approvals.
2. Have the communication owner send the approved maintenance notice. This is
   an external action and requires approval.
3. Freeze the exact approved Bible source and verify its anonymous profile. The
   source does not enter GitHub, ordinary logs, or deployment artifacts.
4. Capture the target's pre-change backup/recovery point and record its opaque
   provider identifier without credentials or production data.
5. Restore that recovery point into an isolated target and reconcile critical
   counts/content fingerprints within the RTO budget.
6. With traffic still disabled, apply the reviewed additive Prisma migrations.
7. Stage the exact application release with no user traffic and verify
   liveness/logging. The application tolerates an empty Bible catalog only
   during this closed compatibility window.
8. Activate the approved JSS3/NKJV rights metadata, import the exact Bible dump,
   and require full plus safe sample fingerprint reconciliation. A rerun must
   report `unchanged`.
9. Provision only approved platform operators and Church accounts. Transfer
   one-time credentials through the direct process; there is no email service.
10. Run readiness and every smoke check below against the staged target.
11. Obtain a fresh traffic-cutover approval and enable production traffic.
12. Observe the stabilization window with the named incident commander and no
    unowned critical alerts.
13. Have the communication owner send the completion notice and attach only
    anonymous evidence to the release record.

The old Ginmaku service remains the source of truth until step 11. Levi becomes
the sole source of truth for new accounts, folders, and bookmarks at step 11.
There is no dual-write interval.

## Mandatory stop conditions

Stop before the next step when any of these occurs:

- approval, target, release identifier, source checksum, or owner differs from
  the release record;
- backup capture, archive validation, isolated restore, RPO, or RTO proof fails;
- translation rights/provenance is not approved or Bible source/count/fingerprint
  differs from the signed-off rehearsal;
- schema migration fails, reports drift, or requires an unreviewed destructive
  change/lock window;
- Bible reconciliation is not exact or the idempotent rerun changes data;
- readiness, login, search, projection, bookmark, or tenant-denial smoke fails;
- a credential, Bible text, personal data, hostname, or connection detail
  appears in ordinary logs/artifacts;
- any critical signal has no human owner or remains active.

Stopping does not itself authorize rollback, restore, secret rotation, user
communication, or a second production attempt.

## Smoke and monitoring

Before traffic and again during stabilization, verify:

1. liveness and PostgreSQL readiness;
2. platform-operator login and protected administration access;
3. Church login and logout;
4. Japanese, NKJV, and bilingual scripture search;
5. real controller/audience window synchronization;
6. end-verse, chapter, and book boundary navigation;
7. folder/bookmark save, reopen, and physical delete;
8. foreign and guessed tenant resources receive indistinguishable denial;
9. no unexpected browser, application, security, or data-integrity error.

Issue #81 selects the monitoring provider and routing. Its disposable proof must
show redaction before it receives production data. Minimum alerts are:

| Signal                        | Proposed critical threshold                    | Required owner action                                       |
| ----------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Readiness                     | Two consecutive failures                       | Stop traffic/new cutover steps and inspect DB/deploy state. |
| HTTP 5xx                      | More than 2% for 5 minutes                     | Declare incident; compare release and request IDs.          |
| Login failures                | Sudden baseline deviation or sustained 5xx/429 | Distinguish attack/rate limit from auth or DB failure.      |
| Database connectivity         | Any sustained failure over 1 minute            | Remove traffic and evaluate provider status/recovery.       |
| Bible query or saved mutation | More than 1% failures for 5 minutes            | Stop affected workflow; preserve anonymous codes.           |
| Backup age                    | Newest usable point older than 60 minutes      | Block release and restore claims.                           |
| Restore proof age             | Older than 90 days                             | Block release until a new isolated restore passes.          |

## Recovery decision

| Point of failure                       | Default safe response                                                                                                                      | Prohibited shortcut                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Before traffic, before DB commit       | Stop and correct the cause; rerun the gate from its start.                                                                                 | Continue with partial evidence.                                 |
| Before traffic, after schema/import    | Prefer reviewed forward correction or discard the closed staged target; restore only with approval.                                        | Expose a partially reconciled catalog.                          |
| After traffic, application-only defect | Disable traffic or roll back the application only when the previous version is schema-compatible.                                          | Restore the DB and lose new writes.                             |
| After traffic, data-integrity defect   | Freeze writes, preserve evidence, and let the incident commander choose approved forward recovery or verified restore plus reconciliation. | Unreviewed deletes/updates or automatic failover to stale data. |
| Suspected credential compromise        | Contain access, assess scope, then rotate/revoke through the approved secret/identity process.                                             | Paste or regenerate secrets in GitHub/CI.                       |

After traffic begins, database restore is not a routine rollback because it can
discard newly created accounts, password changes, folders, and bookmarks. It
requires an explicit loss-window assessment against RPO and human approval.

## Communication templates

Before release (fill only approved times and contact route):

> Leviの初回リリース作業を実施します。作業中は利用を停止し、完了連絡まで最新版Chromeでアクセスしないでください。開始・終了予定は承認済みの時間を記載します。

After successful release:

> Leviの初回リリース作業と動作確認が完了しました。最新版Chromeでログインし、問題がある場合は承認済みの連絡先へ発生時刻と画面名をお知らせください。認証情報や聖書本文は送らないでください。

An incident notice states confirmed impact, start time, current containment,
next update time, and approved contact route. It never includes credentials,
Bible text, personal data, raw errors, or speculative cause.

## Repository-only rehearsal

These commands operate only on local/CI disposable resources and do not grant
production authority:

```bash
pnpm release:checklist:dry-run
pnpm backup:rehearse
pnpm migration:bible:rehearse /approved/local/path/ginmaku.sql
pnpm test:e2e
pnpm check
```

The checklist dry-run must return `prepared-with-human-gates`,
`productionExecuted: false`, seven pending human gates, and 13 ordered steps.
A passing dry-run means the plan is structurally complete, not that production
is ready or approved.
