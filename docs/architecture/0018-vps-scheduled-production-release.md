# ADR 0018: Run Tuesday production releases on the existing VPS

- Status: accepted; owner approved the exact App credential, pinned gh package,
  trusted host bundle/entrypoint and timer activation in Issue #563 on2026-10-26.
- Date: 2026-10-26
- Decision owners: product owner and operations owner
- Decision record: Issue #563
- Supersedes: ADR 0005's workstation-only release initiation for this narrow path

## Context

The owner requested Tuesday 10:00 Asia/Tokyo releases of unreleased main commits,
without per-run approval, and explicitly requires execution while the Mac is off.
The existing VPS is already always on. GitHub holds no production SSH key and
there is no trusted self-hosted runner. PR CI must not gain deployment authority.

## Decision

Install a root-owned deterministic scheduler bundle and a systemd oneshot timer
on the existing VPS. Use `OnCalendar=Tue *-*-* 10:00:00 Asia/Tokyo`, one-second
accuracy, no randomized delay, no missed-run catch-up and no automatic restart.
The launcher also enforces the Tuesday 10:00 hour. No model, desktop app or
Mac participates in execution. This adds no server or inbound network opening.

Use a dedicated GitHub App installed on `iwaseasahi/levi` only: Actions write
(dispatch/watch/download/cancel), Checks read, Contents read and Variables write
(deployment metadata). Metadata read is implicit. No contents write, secrets,
administration, packages, organization or model-provider permission is needed.
App permissions are repository-wide within those categories; this is a real
credential grant, not a workflow-only capability. The owner approved this exact
grant and protected key installation on2026-10-26.

Keep the private key root-owned mode 0600 outside the repository. systemd loads
it as a service credential; a small standard-library Python/OpenSSL wrapper
mints repository/permission-restricted installation tokens and keeps only a
mode-0600 runtime cache. Neither key, JWT nor token is printed or passed in
command-line arguments. Root deploy checks use the same App identity. This is
GitHub service authentication, unrelated to Codex/model authentication.

The bundle runs from root-owned installed files, fetches the public canonical
repository into a separate root-owned state directory and selects one exact main
SHA. It requires all four CI jobs before executing that committed snapshot. It
reuses existing image publishing and immutable authorization artifacts. It does
not install packages or build images on production during a release.

Both the manual and scheduled paths enter the same root-owned host entrypoint.
The host revalidates the exact successful main authorization artifact and holds
one transaction lock across authorization/state checks, checkout, deploying
metadata, backup/migration/readiness and ready metadata. Only this host writes
deployment state. The scheduled call also requires Tuesday, no Sunday approval,
a matching last-successful host record, a fingerprint of the exact ready metadata
and forward ancestry. A changed baseline
stops before checkout. The application-level deployment lock remains in place.

Root is used because the existing fixed deployment operation already needs root
for the Docker/backup/migration path. Root-owned committed code is the existing
trust boundary; no writable runner, interactive model or PR job gets root.
The service has no automatic retry; ambiguous failure requires inspection.

## Activation and recovery

Merge only after review and exact-head CI. Provision the approved App key directly
to the protected host path without copying its value into Codex. Install the
reviewed bundle/entrypoint/units separately from timer activation. Verify unit
syntax, safe preflight and next trigger; never run a production release as a test.
Disable the timer to stop new automatic runs; preserve in-progress work and
deployment history. Revoke the App installation/key to remove GitHub access.

The existing operator's authenticated sudo is used for the one-time installation;
no new broad passwordless sudo rule is added.

No new SSH identity, firewall change, paid service, Sunday authority, import,
restore, production-data fixture or secret/runtime rotation is authorized here.
The VPS remains a single failure domain; a powered-off/unhealthy VPS can miss a
Tuesday release. Service failures remain visible in systemd/journal evidence.

## Alternatives

- Mac/Codex scheduling: rejected by the owner's independence requirement.
- GitHub-hosted SSH: would need another production key and broader or changing
  network access; provides no advantage over the already running VPS.
- Self-hosted Actions runner on production: exposes a general workflow executor
  to production and is broader than this deterministic timer.
- Additional server: adds cost and operational scope without an initial need.
- Personal access token: binds operation to a human credential and renewal;
  repository-only App installation tokens have a clearer revocation boundary.

## References

- [systemd 255 timer](https://www.freedesktop.org/software/systemd/man/255/systemd.timer.html)
- [systemd 255 credentials](https://www.freedesktop.org/software/systemd/man/255/systemd.exec.html#LoadCredential=ID:PATH)
- [App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Workflow dispatch permissions](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
- [Repository variable permissions](https://docs.github.com/en/rest/actions/variables#update-a-repository-variable)
