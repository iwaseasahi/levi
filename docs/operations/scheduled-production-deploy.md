# Tuesday unattended production release

Owner decision: Issue #563. Tuesday at **10:00 Asia/Tokyo**, deploy only when
main has unreleased commits, without per-run human or Environment approval.
The owner explicitly requires execution while the Mac is stopped/asleep.
[ADR 0018](../architecture/0018-vps-scheduled-production-release.md) accepts the
existing VPS systemd timer. **The owner approved the exact App credential, gh
package, host bundle/entrypoint and timer activation on2026-10-26. Installation,
read-only preflight and timer activation completed that day.**

## Execution and trust

The VPS executes deterministic Bash/Python from a root-owned installed bundle;
there is no Codex/model invocation or general self-hosted runner on production.
No additional server, SSH key or firewall opening is needed. GitHub still builds
images and validates exact-release artifacts, without production SSH access.

A dedicated GitHub App is installed on **iwaseasahi/levi only**, with repository
permissions **Actions: write, Checks: read, Contents: read, Variables: write**
and implicit Metadata: read. All organization/account permissions, webhooks,
Contents write, Secrets, Administration and Packages remain disabled. These
category permissions apply across the repository, not just two workflows.
Actions write permits dispatch/cancel; Variables write updates deployment state.
The owner approved this credential grant and its protected host installation on
2026-10-26, separately from the already approved scheduled releases.

The App key is `/etc/levi/release-app.pem`, root:root 0600. Non-secret IDs are in
`/etc/levi/release-app.json`, also root:root 0600:

```json
{ "app_id": 123, "installation_id": 456 }
```

Those numbers are examples, not real IDs. Provision the key directly through the
approved host secret channel. Never paste it or an installation token into Codex,
a chat, terminal output, Issue, fixture, PR, or artifact. No human personal token
or local Codex/GitHub login is copied to production. There is no application
runtime secret rotation as part of this operation.

The token wrapper signs a short JWT in memory with OpenSSL, requests an
installation token explicitly restricted to `levi` and the above permissions,
and rejects a different repository, broader permissions or invalid lifetime.
It caches the token as root-only `/run/levi-release-auth/token.json`, refreshes
near expiry, and provides it to `/usr/bin/gh` via its process environment. Tokens
are never argv or stdout. Authentication/signing/HTTP failure reports a fixed
message without raw responses. systemd supplies the private key as a credential;
root entrypoint calls use the same protected key directly. No JWT/token is
stored in Git or the long-lived installation config.

## Deterministic release sequence

1. `levi-release.timer` requests `Tue *-*-* 10:00:00 Asia/Tokyo`, with one-second
   accuracy, no randomized delay, no persistent catch-up and no automatic retry.
   VPS clock/scheduler availability is still required; this is not an SLA.
2. The root launcher refuses a start outside Tuesday's 10:00 hour, takes a host
   preparation lock, and uses `/var/lib/levi-release/repository` as an isolated
   public canonical Git clone. It does not change `/opt/levi` while preparing.
3. Pin `origin/main`. Validate the non-secret schema-1 ready deployment record.
   Same SHA skips before image publishing, authorization or application. Missing,
   malformed, deploying or non-forward state stops. Require exact latest Quality,
   Database, E2E and Security success.
4. Run existing preparation from the exact checked detached snapshot, publish
   digest-bound app/migration images, validate its immutable artifact, then
   dispatch/wait for existing production validation. No package install or image
   build happens on the VPS. Cancel/fail rather than waiting for Environment
   approval. The bounded unattended wait is 1200 polls (about one hour plus API
   request time at the default three-second interval).
5. The shared root host entrypoint takes `/var/lib/levi-deploy/.transaction.lock`
   **before checkout or state changes**, independently verifies the successful
   canonical main authorization artifact and exact commit/images/Sunday binding,
   and rechecks all four CI jobs. Scheduled calls require Tuesday, the previous
   SHA plus a fingerprint of the full ready record, matching actual host history
   and forward ancestry. State changed by a
   manual deployment stops before checkout. All supported manual clients now
   leave deployment-state writes to this host transaction too.
6. Under that lock, checkout the selected main commit, record `deploying`, invoke
   the existing host application path (its own lock, encrypted operational
   backup, forward migrations, image labels, Compose readiness and history), then
   record `ready` only after success. State writes cannot race across Mac/VPS.
   Failed/ambiguous apply leaves `deploying`; inspect before another automatic run.

Root commands clear the caller's environment and use fixed installed helpers.
Clients require host protocol version 2 before any apply, so merging code before
installation stops safely rather than silently skipping deployment-state updates.
The approved operator's existing command-scoped sudo remains; no new sudo user
is introduced. Use current main's manual client after rollout. Older clients
that write metadata outside the host transaction are unsupported; mismatched
host/GitHub history makes the next scheduled release stop safely. Sunday manual
Environment and host guards remain in effect. No new scheduled Sunday authority.

## Reviewed installation and activation

Do this **only after exact credential/access and host installation approval**,
merged ADR/policy and four successful protected checks on the merged installer
source. Keep the reviewed commit SHA and App installation ID in Issue #563,
never its key/token. Read-only prerequisites: Ubuntu 24.04/systemd 255, existing
root-owned `/opt/levi`, operator sudo entrypoint, current deployment history,
working existing image-pull/backup credentials, `/usr/bin/{git,gh,jq,python3,openssl}`,
network/DNS/TLS and time synchronization. Read-only inspection confirmed systemd 255 and these tools except `gh`. The
Ubuntu candidate is `gh=2.45.0-1ubuntu0.3`. Adding that package with
`apt-get install --no-install-recommends gh=2.45.0-1ubuntu0.3` is included in the
approved one-time host change; the installer itself fails on a missing dependency
rather than installing it.

1. An authorized owner creates/installs the App on just this repository and
   provisions its key/config at the protected paths above. Disable webhooks and
   user OAuth requests. Do not give it branch-protection bypass or model access.
2. In a **root-owned disposable clone** of the canonical repository at the exact
   reviewed, merged commit, run:

   ```bash
   bash scripts/install-production-scheduled-release.sh MERGED_COMMIT_SHA
   ```

   The installer validates source commit/main ancestry, local cleanliness, key
   ownership/modes and exact CI before replacing installed files. It requires
   the old release timer/service to be inactive and holds the host transaction
   lock while installing. It installs the fixed bundle, updated entrypoint with
   existing operator-only sudo policy, and service/timer units, then verifies
   systemd syntax and reloads. **It does not enable/start either unit.**

3. From the host, run the installed root launcher **with `--dry-run`**. This reads
   Git and non-secret metadata, verifies host history and protocol, starts no
   image/authorization workflow, and does
   not connect to production SSH or apply a release:

   ```bash
   /usr/local/lib/levi-release/scripts/run-host-scheduled-production-release.sh --dry-run
   systemd-analyze calendar 'Tue *-*-* 10:00:00 Asia/Tokyo'
   ```

4. After successful preflight, enable/start **only the timer**, not the service:

   ```bash
   systemctl enable --now levi-release.timer
   systemctl list-timers levi-release.timer --no-pager
   systemctl show levi-release.timer -p NextElapseUSecRealtime -p ActiveState
   ```

   Record the next trigger as Tuesday 10:00 JST in Issue #563. `Persistent=false`
   prevents an immediate missed-run catch-up. Never `systemctl start
levi-release.service` as a test. No live deploy is part of activation testing.

Installer source and installed files are committed/reviewed; root-owned installed
code is updated explicitly with the same installation procedure when relevant
scripts change. No runtime self-modification or package auto-install is added.

## Failure, disable and recovery

Inspect `systemctl status levi-release.service` and `journalctl -u
levi-release.service`; output is operational status only, not application data or
credentials. A no-op prints the already released SHA. A failed service remains
observable; no automatic retry/rollback or claim of success. Existing application
health monitoring continues, but is not a substitute for checking release status.

Stop new scheduled starts with `systemctl disable --now levi-release.timer`.
Disabling the timer does not kill an in-progress release. Inspect it before any
bundle replacement; never delete an active lock. A stale lock after a crash is
removed only after confirming no launcher/host/application process owns it.
If apply or metadata recording fails, reconcile host history and actual readiness
through the approved operations path before restoring a valid ready record.
Automatic production rollback, imports and restores remain outside this path.
Revoke the App installation/key to remove GitHub authority; remove its private
runtime cache during an approved credential revocation. No SSH change is needed.

Synthetic tests fake GitHub/Git/SSH/date and host paths; they do not contact
production or use real runtime data. The existing Mac entry's `--dry-run` also
remains available for read-only release selection. It is not the chosen scheduler.

## Approval / provisioning record

Issue #563 records the owner's explicit one-time approval of the App grant/key,
pinned gh package, trusted bundle/entrypoint and timer activation. The App is
`levi-tuesday-releases` (App5476038, installation175360432), installed only on
`iwaseasahi/levi`; webhooks and user OAuth are disabled. Variables is the
`actions_variables` installation-token permission key, matching GitHub's actual
App registration UI. No permission scope was expanded by that API spelling fix.
The private key value is never recorded here. The existing operator authenticates
sudo for installation; no broader passwordless rule or SSH user is added.

## Active installation (2026-10-26)

PR #564 merged as `37acf87963208c1e23c40165a5861b7d35c14ab2`.
All four protected jobs passed on that merged commit in
[CI run40282927929](https://github.com/iwaseasahi/levi/actions/runs/40282927929).
The root-owned bundle's `installed-commit` records that exact SHA; the fixed
entrypoint reports protocol `2`. The approved `gh=2.45.0-1ubuntu0.3` is installed.
Root provisioning verified App repository/scope, protected key/config modes and
existing production credentials without printing their values. Temporary key
copies on the workstation and operator staging path were removed.

The installer and installed launcher's read-only preflight succeeded before
enabling the timer. At activation, `systemctl show` reported:

```text
ActiveEnterTimestamp=Mon 2026-10-26 07:02:42 UTC
ActiveState=active
UnitFileState=enabled
NextElapseUSecRealtime=Tue 2026-10-27 01:00:00 UTC
LastTriggerUSec=
```

The first scheduled check is **2026-10-27 at10:00 Asia/Tokyo**. The service was
`inactive`/`dead`, with no `ExecMainStartTimestamp`; activation did not start a
release. The existing successful release remained unchanged. Later runs use
the main commit and successful deployment record observed at execution time,
with the checks above; these activation facts do not predict a future result.
