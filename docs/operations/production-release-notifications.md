# Scheduled release Slack notifications

Issue #566 / [ADR0019](../architecture/0019-production-release-notifications.md).
The owner approved the design and selected **JC Project** (`T5V5BH4AF`), private
**#levi-deploy** (`C0CCB7UGHJS`), operator **岩瀬旭**. The private channel was
created on2026-10-27 with the operator as its only human member. The owner added
a channel-specific Incoming Webhook to the existing **notification-bot** App
(`A015P0E6KC4`) and completed protected host setup on the same day. Existing
**#monitoring** (`C015A32HDM4`) and its notification route remain unchanged.
Future source merges still require explicit reviewed host installation.

## Active installation (2026-10-27)

The owner selected the existing App in response to the exact activation request,
created the channel Webhook, and executed the hash-verified setup through the
existing operator sudo path. The credential was entered at a hidden VPS TTY,
never in a chat, command argument or development file. The setup validated its
root-owned0600 regular file at `/etc/levi/release-slack-webhook.url`.

- Installed bundle: `7124e8f93538dc8744b265a8361b81aba7a48cce` (#568),
  protocol2. All four protected checks passed on its merged source in
  [CI run40443858447](https://github.com/iwaseasahi/levi/actions/runs/40443858447).
- Activation completed at **2026-10-27 13:27:07 JST**. Both `levi-release.timer`
  and `levi-release-notify.timer` are enabled and active. The next deployment
  trigger is **2026-11-03 10:00 JST**; notification fallback runs every minute.
- Exactly one fixed test was delivered at **13:27:04 JST** by notification-bot
  to #levi-deploy. The same message/event was verified in the Slack channel:
  `01c04cbf27c14accae0581c5d15aebe1:test`. Private status reported
  `unfinished=0, pending=0, sent=1, dead=0, suppressed=0`.
- Application release remained `a9eddac0efb6417fdc800ef68df5db3ac68643cd`;
  host history and GitHub ready metadata were unchanged. Public `/api/ready`
  returned ready with database ok. The release service last ran at10:00–10:04:37
  JST that morning; no deployment was started during notification activation.

The scheduled start/success/failure/skip paths have regression evidence in #567
and #568. Initial activation used only the fixed test; the separately requested
real-release check is recorded below. The first timer-triggered notification
remains the next normal timer run. The existing App
permissions outside the channel Webhook, GitHub grants and monitoring route were
not changed. A protected copy of the previous scheduler was preserved for recovery.

## Owner-requested real release check (2026-10-27)

In [Issue #570](https://github.com/iwaseasahi/levi/issues/570), the owner explicitly
requested one real production deploy to verify the messages. After the owner
authenticated the existing operator sudo path, a hash-verified, expiring,
single-use root helper invoked the unchanged host entrypoint and existing
observer/outbox. This was an owner-triggered operation, not a timer firing.
The fixed message's `scheduled` label identifies the shared root release path;
it does not establish that the timer ran. No general manual-notification mode
or standing authority outside the normal window was added.

- Release: `7874727567c8e7f6de371f4f139ca62af73b4efe`, forward from a9eddac.
  All four protected jobs passed in
  [CI run40450839883](https://github.com/iwaseasahi/levi/actions/runs/40450839883).
- Immutable [candidate40451607643](https://github.com/iwaseasahi/levi/actions/runs/40451607643)
  and [authorization40452087072](https://github.com/iwaseasahi/levi/actions/runs/40452087072),
  both attempt1, were verified again on the host.
- Application: `ghcr.io/iwaseasahi/levi@sha256:29ed32f7a83830b7d0cef2791f90bd272ac42d1567d93fd9237890a8c4bef82e`.
  Migration: `ghcr.io/iwaseasahi/levi-migrate@sha256:26ec26b09b72f8754cd4417756c9c3aeaf17c42ec7d3530384077aac84caa0ae`.
  No schema/migration additions existed in this release. The ordinary encrypted
  backup, forward-migration check, readiness and cleanup still ran.
- Start: **14:21:02 JST**. Success: **14:21:42 JST**, elapsed **40seconds**.
  Release ID: `52142a5ee4614202a141cb8ecd31ec7f`. The `:started` and `:succeeded`
  events were each delivered on attempt1, and both were observed in the actual
  private #levi-deploy channel from notification-bot.
- The fixed host's post-ready witness was positive; the operation exited0 with
  no warning. GitHub ready metadata matched the exact commit, both digests and
  authorization, recorded at05:21:41 UTC. Public `/api/ready` returned ready with
  database ok. This verifies real host completion, not only Actions success.
- The installed scheduler bundle remains7124e8f. The release and notification
  timers remain active; the next normal release is **2026-11-03 10:00 JST**.
  No timer, clock, start-window guard, permission or credential was changed.

The first one-time invocation stopped before observation/application because its
preparation clone used `--no-checkout` before an index-clean check. That helper
defect was reproduced and corrected with six disposable Git preflight cases;
the original production state was unchanged. The corrected invocation was the
only actual deployment. Its attempt marker prevents another application; do not
rerun a deployment to retry notification delivery.

## Meaning of the messages

- Start means an unreleased commit and valid baseline were selected, before CI,
  image preparation and production application. It is explicitly release preparation.
- Success requires the fixed VPS host entrypoint to complete application,
  readiness, host history and the GitHub `ready` state write. Actions validation
  alone and a successful runner exit are insufficient.
- Failure names a fixed stage and exit status, not command output. Interruption
  before apply is aborted; an unresolved interruption during apply is unknown.
  Confirmed host success followed by cleanup/process errors remains success
  with a warning. Reconciliation can establish success from exact ready metadata
  and matching host history when the immediate witness was lost.
- An unchanged main commit posts one skip, without a start/success pair.
- Dry runs and outside-window starts do not enqueue production messages.
- A fixed `notification-test` message explicitly says no deploy happened.

Every message has a release/event ID, JST timestamps, commit and known canonical
Actions links. No commit message, raw output, environment, application content,
personal contact information or credential value is copied. Separate start and
terminal posts require no Slack history scope or thread lookup.

## Source of truth and storage

The release service runs the installed observer, which starts exactly the existing
root launcher and preserves its exit status. Fixed Bash hooks only observe; an
observation error cannot skip a safety check, write deployment state or change
the deploy outcome. Manual SSH clients do not supply an observation identity.
Only the root scheduled host path can record its post-ready success witness.

Private state is under `/var/lib/levi-release-notifications`, directories0700 and
files0600. Atomic writes, a state lock and separate worker lock protect records.
The owner/child PID, kernel start ticks and boot ID prevent PID-reuse recovery
mistakes. Exit handling and `ExecStopPost` reconcile normal/abnormal completion;
the delivery timer also reconciles dead runs after restart. It never restarts a
deploy. A still-live parent or child prevents premature terminal reconciliation.

The worker performs no HTTP while holding the state or deploy lock. Notification
failure cannot change deploy state, application health, backup/migration behavior
or deployment exit status. Existing monitoring is independent.

## Delivery and operational limits

`levi-release-notify.service` receives only the Slack credential. New events
request an asynchronous worker; `levi-release-notify.timer` runs after boot and
each minute as fallback. Normal delivery target is within one minute, subject
to host/network/Slack availability. It is not an availability guarantee.

Connect timeout is3seconds; an isolated subprocess bounds the complete request,
including DNS, to10seconds. Only HTTPS `hooks.slack.com` is allowed, without
redirects or inherited proxy settings. HTTP200 must return `ok`. Rate limiting
respects `Retry-After`; other retryable failures wait at least60seconds. Each
event has at most5 attempts and expires24hours after occurrence. Permanent4xx
and failed/expired delivery remain visible as `dead`; the worker returns failure.
Only notification delivery is retried, never deployment, migration or backup.

Local event identities prevent duplicate enqueue/senders. HTTP response loss
after Slack accepted a message can still duplicate a post; event IDs make that
ambiguity visible. Terminal delivery has priority and suppresses a pending late
start; terminal text still includes its start time. Delayed messages say so.
Completed records with no pending delivery are retained7days; at most1000 run
records are admitted. A full or unsafe queue reports observation failure without
stopping deploy. Inspect it before changing/deleting evidence.

## Reviewed provisioning and activation

Prepare and review the exact source SHA, channel/private membership, Webhook
grant, protected paths, units and test message before the governance-required
production approval. The implementation/design approval is not an unspecified
credential or running-service authorization. Do not print the existing monitoring
secret or copy it to this new purpose.

1. Verify JC Project / private #levi-deploy and the operator; record the non-secret
   channel ID. Create a channel-specific Incoming Webhook using `notification-bot`
   if that existing App permits it. Add only the access necessary for this channel.
2. Provision the new URL directly through the approved protected channel as
   `/etc/levi/release-slack-webhook.url`, root:root0600, in the existing root-only
   credential directory. Never show it in a prompt, command argv, screenshot,
   Issue, PR or log. The worker validates both original and systemd-copy modes.
3. With no active release, stop the existing release timer and any notification
   timer before replacing the bundle. The reviewed installer refuses active units
   and retains the shared transaction lock. Preserve the prior installed SHA and
   protected configuration for recovery.
4. Run `install-production-scheduled-release.sh MERGED_REVIEWED_SHA` from a clean,
   root-owned canonical clone with all four exact merged CI jobs successful.
   It installs the observer/helper and all four release/notification units, verifies
   syntax and reloads; it never starts or enables them.
5. Run the installed root launcher with `--dry-run` and inspect protocol/history.
   Enable only the Tuesday release timer and minute notification timer. Do not
   start `levi-release.service` as a test.
6. After explicit test-send approval for the selected channel, enqueue exactly
   one fixed test:

   ```bash
   /usr/bin/python3 /usr/local/lib/levi-release/scripts/production-release-notifications.py queue-test
   ```

   This only records a fixed test event and requests the notifier. It does not run
   a deployment, read application data or update deployment metadata. Verify the
   intended private channel receives one fixed message and record its event ID,
   channel ID and delivery result without the Webhook value.

7. Verify both timers enabled/active, the saved next Tuesday trigger, unchanged
   application release, and the observer status. Record activation in #566; keep
   the Issue open until actual installation/test acceptance is satisfied.

The notification worker's Slack credential directory is not an App credential
directory. Recovery clears that directory from the App CLI environment and uses
the existing protected App identity. No extra GitHub permission/secret is needed.
The root bundle still requires explicit reviewed installation when scripts change.

## Status, failures and disable

Administrative commands on the VPS, through its existing approved root path:

```bash
systemctl list-timers levi-release.timer levi-release-notify.timer --no-pager
systemctl show levi-release.service levi-release-notify.service -p Result -p ExecMainStatus
/usr/bin/python3 /usr/local/lib/levi-release/scripts/production-release-notifications.py status
journalctl -u levi-release-notify.service --no-pager
```

Status prints counts of unfinished, pending, sent, dead and suppressed events only.
Journal messages contain fixed outcomes and event IDs, never transport errors or
response bodies. A dead event is not silently reset; inspect configuration and
the original result before a separately reviewed replay. No unbounded resend tool
or command to change production readiness is provided.

Stopping the notification timer alone stops periodic retries, but new releases
can still request its service. To pause **all** outgoing notifications, use the
approved operation `systemctl mask --runtime --now levi-release-notify.service`
and stop its timer; this does not stop deployment or remove the queue/credential.
After recovery, unmask and restart the timer/service only through the approved
operations path. Review pending age/expiry before delivery resumes.

VPS shutdown cannot send an immediate terminal message. Slack outage also cannot
be reported reliably through that same Slack route. Use the retained private
state/systemd result and existing external readiness checks; never interpret
missing Slack delivery as evidence that deployment succeeded or did not run.
Do not delete active locks, queue records or credentials as troubleshooting.
