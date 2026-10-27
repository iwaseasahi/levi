# ADR 0019: Observe scheduled releases with a separate Slack delivery worker

- Status: accepted design in Issue #566 on2026-10-27; production credential and
  installation activation remain separate approval-bound operations.
- Date: 2026-10-27
- Decision owners: product owner and operations owner
- Related: ADR0018, Issues #563, #335 and #566

## Context

The owner wants start and terminal notifications for the VPS-local Tuesday
release. The owner selected private #levi-deploy in JC Project with 岩瀬旭 as
the operator. GitHub image/authorization success precedes actual host application
and cannot establish production success. Slack unavailability must not affect
application safety, metadata ownership or deployment results.

## Decision

Use root-owned installed Python standard-library code for private atomic event
state, a per-attempt identity, recovery and an independent delivery worker.
The scheduled process observes only fixed stages and validated public commit/run
identifiers. The existing host transaction records a success witness only after
application readiness, successful host history and the ready metadata write.
Recovery verifies ready metadata and matching host history when a witness is
unavailable; uncertainty is explicit, never a successful process exit assertion.

Only the separate worker receives a channel-specific Slack Incoming Webhook via
systemd LoadCredential. A private durable queue survives process failure/reboot;
worker locking, event identities, bounded retention and attempts prevent local
duplication and unbounded work. Transport ambiguity can still duplicate a post;
include the event ID and original event time. Never retry a deployment to retry
a notification. Outside-window starts, dry runs and synthetic tests do not send.

Notifications contain fixed Japanese text, exact commit/run links, JST times,
elapsed time and fixed stage/result codes. Never send arbitrary command output,
commit messages, application data, environment dumps or credential values.
HTTP uses only the approved Slack HTTPS origin, no redirects or inherited
proxies, bounded connect/overall time, redacted errors and Retry-After handling.
Slack failure never changes deployment exit/state or holds the transaction lock
for network work. Event state remains local operational evidence.

## Consequences and activation

An independent oneshot worker and minute retry timer add host operational state,
not a new server, runner, paid service or GitHub App grant. Existing monitoring
routing is unchanged. Start and terminal messages are separate posts with the
same release ID; no extra Slack read/history scope or thread lookup is needed.
Preserve all required CI, authorization, immutable images, backup, migrations,
readiness, locks, Tuesday constraints and Sunday manual approval.

Inspect the actual workspace/channel and existing Slack App before provisioning.
The Issue design approval does not provision a secret or authorize an unspecified
host/test operation. Prepare exact reviewed source, paths, units, channel IDs
and a fixed non-sensitive test, then obtain the required activation approval.
No live deployment or outage simulation is needed to test notifications.

Disable the delivery timer to stop retries and the observer only through the
documented reviewed configuration. Do not erase an active attempt or transaction
lock. Preserve pending evidence; revocation and deletion retain their separate
approval boundaries. A stopped VPS cannot send immediately; keep external
readiness monitoring and document recovery/retention limits.

## References

- [Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks)
- [Slack rate limits](https://docs.slack.dev/apis/web-api/rate-limits/)
