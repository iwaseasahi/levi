# Tuesday unattended production release

Owner decision: Issue #563. Tuesday at **10:00 Asia/Tokyo**, deploy only when
main has unreleased commits. The scoped authorization is recorded in
[governance](../governance/autonomy.md#preauthorized-tuesday-production-release)
and [ADR 0005](../architecture/0005-deployment-selection-gate.md).
No per-run human or Environment approval is needed for this Tuesday path.

## Execution boundary

The existing trusted execution path is the allowlisted operator workstation
with its existing GitHub login and pinned `levi-system-production` SSH alias.
GitHub does not store a production SSH key and there is no self-hosted runner.
The choice between this workstation and a new independent always-on executor
is pending the owner's answer in #563. **The scheduler is not enabled by this
runbook or by merging the common execution code.** Do not add credentials,
runner identities, firewall access or paid infrastructure without that decision
and any specific access approvals it requires.

A workstation-based schedule needs the Mac, network, authenticated tools and
scheduler available at the appointed time. A missed start outside Tuesday's
10:00 hour is skipped; it is not replayed on another day. Once started, release
preparation may finish later in the day, but unattended application must start on Tuesday.

## Deterministic execution

The scheduler invokes only:

```bash
bash scripts/run-scheduled-production-release.sh
```

1. Require Tuesday's 10:00 hour in Asia/Tokyo and acquire the shared preparation
   lock under the Git common directory.
2. Fetch canonical origin/main and pin one SHA. Read the non-secret
   `LEVI_PRODUCTION_DEPLOYMENT` GitHub variable; require its strict ready record.
3. If the successful deployment commit equals main, exit without image builds,
   authorization or a production connection. A candidate or a failed attempt
   does not count as a successful deployment.
4. Require production's commit to be an ancestor of the target; automatic
   rollback is forbidden. Verify all four latest protected CI jobs for the SHA.
5. Check the existing BatchMode SSH path and create a disposable detached checkout
   at the verified SHA, without modifying the operator's working checkout.
6. Use the canonical preparation script with that pinned SHA and a new JSON output
   file. Candidate images remain immutable and bound to the selected SHA/run.
7. Recheck ready state and invoke the canonical deployment flow in unattended mode.
   If another release already finished, skip. Any other changed state stops.
8. The apply script acquires the shared operator lock under
   `${XDG_STATE_HOME:-$HOME/.local/state}/levi/production-deploy.lock`, rechecks
   exact authorization/commit/day/state, records deploying, rechecks Tuesday on the
   remote host, applies through the
   constrained host entrypoint, then records ready only after success.

The host still validates images/revision, takes an operational backup, applies
forward migrations, waits for readiness and records history. Manual applications
using the current operator command share the apply lock. Keep one approved
operator account/state directory; this local lock is not a distributed lock for
new executor hosts. The host's existing deployment lock also remains enforced.

## Read-only production preflight

```bash
bash scripts/run-scheduled-production-release.sh --dry-run
```

This may fetch Git refs and read the deployment metadata, but never publishes an
image, dispatches an authorization or contacts production. It can run on any day
and does not authorize an immediate release. The new preparation `--commit` and
`--output` options preserve the manual no-argument command.

## Failures and cancellation

Missing, malformed or non-ready state, a fork/non-forward target, failed/missing
CI, an active lock or a changed record stops automatic application. Never invent
a deployment baseline or clear a failed deploying record by hand just to continue.

Unattended authorization is limited to 1200 polls (about one hour at the default
three-second interval, plus API response time) and fails immediately if an
Environment review is pending or the day is no longer Tuesday. Failed unattended
waits cancel their validation run and never wait for a person to approve it.
Manual Sunday approval behavior is unchanged.

If apply fails, the record remains deploying and further scheduled releases stop.
Use the existing incident/manual forward-recovery procedure. Do not retry a
production mutation automatically, roll migrations backward, weaken CI, or run
ad hoc Docker/SQL commands. A killed local process can leave a preparation/apply
lock: investigate the host and operation first, then remove only the confirmed
stale empty lock directory. Do not automatically steal locks.

The scheduler reports completion or actionable failure; an unchanged/already
released main should not generate a notification. Actual activation, chosen
executor and next scheduled run must be recorded in #563 after protected merge.
