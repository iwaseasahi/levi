# Scheduled release Slack notifications

Issue #566 / [ADR0019](../architecture/0019-production-release-notifications.md).
The owner approved the design and selected **JC Project** (`T5V5BH4AF`), private
**#levi-deploy** (`C0CCB7UGHJS`), operator **岩瀬旭**. The private channel was
created on2026-10-27 with the operator as its only human member. Its approved
channel-specific Incoming Webhook still needs provisioning. Existing **#monitoring**
(`C015A32HDM4`) and its `notification-bot` integration remain unchanged.
Source implementation does not provision a secret or activate a host unit.

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
