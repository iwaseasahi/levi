# ADR 0005: Deploy production to one WebARENA Indigo VPS

- Status: accepted
- Date: 2026-08-21
- Decision owners: product owner and operations owner
- Decision record: Issue #81
- Recovery-policy amendment: Issue #297 (2026-08-26)
- Supersedes: none
- Superseded by: none

## Context

Initial production serves two Churches and receives most traffic on Sundays.
The product owner prefers a monthly VPS cost at or below JPY 2,000 and accepts
running the application and PostgreSQL on one server. Cross-region disaster
recovery is not required. Domain cost is outside the VPS ceiling.

Managed application and database services provide stronger isolation and
automatic recovery but do not fit the initial cost objective. Shared rental
hosting does not provide the long-running Node.js, Docker, and PostgreSQL
control Levi requires, so the low-cost target must be a VPS.

## Decision

Use one **WebARENA Indigo Linux 4 GB VPS in Tokyo** as the initial production
target:

- monthly VPS ceiling: JPY 1,630 including tax at the decision date;
- 4 vCPU, 4 GB memory, and 80 GB SSD;
- Ubuntu 24.04 LTS;
- Docker Compose runs Caddy, the Levi Node.js 24 application, and PostgreSQL 18;
- PostgreSQL has no published host port and is reachable only on the private
  Compose network;
- Caddy is the only public application ingress on ports 80 and 443;
- SSH uses public-key authentication and host/network firewall rules expose
  only the approved administration and web paths.

GitHub Actions validates the exact commit and image digests and records approval
through the protected `production` Environment, but does not hold a production
SSH key or connect to the VPS. It emits a one-day immutable authorization
artifact. The operator retrieves and verifies that artifact from the
allowlisted workstation, then invokes the fixed command-scoped host entrypoint.
This keeps TCP 22 restricted to the operator's current `/32` while preserving
CI, Issue approval, Environment approval, and host deployment history.

Issue #81 records the product owner's acceptance of no SLA, one application and
database failure domain, and no cross-region recovery. This ADR approves the
architecture, not a provider contract, billed resource, production credential,
DNS change, migration, or deploy. Each remains an immediate human gate.

## Recovery boundary

The initial recovery objective applies only while the VPS and its disk remain
available:

- RPO: no more than seven days of accepted mutable Levi data for operator or
  application error;
- RTO: restore an isolated database, invalidate restored sessions, reconcile,
  pass readiness and critical smoke checks, and make the go/no-go decision
  within 120 minutes;
- weekly on-host database archives are created every Monday and retained for 30
  days;
- event-driven operational archives are created before deploys and imports and
  retained for 48 hours.

VPS loss, disk loss, provider-wide loss, and Tokyo-region loss have no recovery
objective. Provider operational backups are not treated as user restore points.
This is an explicit cost/reliability tradeoff. A future requirement for durable
off-host recovery must supersede this ADR before claiming disaster recovery.

## Secrets and ownership

The single-VPS design has no managed secret store. Better Auth and database
credentials are injected from a root-owned server file with mode `0600`, never
baked into an image, Compose file, repository, CI artifact, Issue, or log.
Application containers receive only the values they require. Creation,
rotation, recovery ownership, and production access remain human-approved
operations.

The production domain is not yet owned. Issue #88 selects the name, registrar,
DNS owner, and final Better Auth origin. Domain cost is separate from the JPY
2,000 VPS objective.

## Availability and operating policy

- There is no contractual SLA for the selected plan and no automatic failover.
- Application and database maintenance, deploys, and migrations are prohibited
  during the Sunday freeze window defined by Issue #87.
- Health, readiness, resource saturation, disk, database, and backup age require
  monitoring, but monitoring must not receive credentials or Restricted data.
- Capacity is accepted only after Issue #89 measures the two-Church workflow on
  a disposable 4 GB target.

## Consequences

### Positive

- Fits the approved monthly VPS ceiling with memory headroom over a 2 GB plan.
- Keeps application/database latency and transfer on one private host network.
- Uses the existing containerized PostgreSQL architecture without a proprietary
  runtime or database integration.
- Leaves room for Caddy, backup, and monitoring processes on the same host.

### Negative and risks

- One VPS, disk, kernel, network, or provider failure stops both application and
  database.
- The team owns OS patching, PostgreSQL operation, backups, restore, security,
  observability, and capacity management.
- On-host backups protect against logical error but not VPS or disk loss.
- The selected plan has no SLA and Sunday availability is not guaranteed.
- A later high-availability or off-host recovery requirement needs a new
  topology and additional cost.

## Alternatives considered

### WebARENA Indigo 2 GB

The lower plan costs JPY 814 per month and may run the current workload. It was
not selected because 2 GB leaves less margin for Next.js, PostgreSQL, Caddy,
backup, and operating-system cache, while 4 GB remains within budget.

### ConoHa VPS 2 GB

Long-term plans can cost roughly JPY 1,000 per month with 3 vCPU and 100 GB SSD.
Campaign, commitment, and renewal-price variation make the fixed Indigo ceiling
simpler for the initial release.

### Sakura VPS 2 GB Tokyo

The annual price is within budget and provides 3 vCPU, 2 GB, and 100 GB SSD. It
offers less memory than the selected Indigo plan at a similar budget.

### Cloud Run and managed PostgreSQL

This separates failure and operational domains but the continuously available
managed database makes the JPY 2,000 target impractical.

## Delivery Issues

- #85: production Compose and host hardening baseline;
- #86: on-host backup, restore, and session recovery;
- #87: manual deploy, monitoring, and Sunday freeze;
- #88: domain, DNS, TLS, and final origin decision;
- #89: billed disposable PoC and capacity/recovery evidence.

## Reconsider when

- more Churches or projection clients cause sustained memory above 75%, swap
  pressure, database connection pressure, or unacceptable p95 latency;
- a Sunday outage or restore exceeds the accepted tolerance;
- off-host backup, disaster recovery, HA, or an SLA becomes required;
- the total recurring infrastructure cost approaches a managed alternative;
- OS, Node.js, PostgreSQL, or provider support can no longer satisfy the pinned
  version policy.

## Verification

- Repository configuration is validated without production credentials.
- A disposable 4 GB target passes migration, local Bible import, login, search,
  projection, saved-content, tenant-denial, backup, restore, and session
  invalidation checks.
- The PoC records CPU, memory, disk, latency, connections, backup age, RPO, RTO,
  and projected monthly cost without production data.
- Production remains blocked until all immediate gates in the release runbook
  are approved.

## References

- [WebARENA Indigo](https://web.arena.ne.jp/indigo/)
- [WebARENA Indigo current price table](https://web.arena.ne.jp/pdf/Indigo_Agreement.pdf)
- [WebARENA Indigo Linux features](https://web.arena.ne.jp/indigo/spec/)
- [WebARENA operational backup boundary](https://web.arena.ne.jp/indigo/spec/dataint.html)
- [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting)
