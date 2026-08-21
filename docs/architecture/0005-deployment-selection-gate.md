# ADR 0005: Preserve deployment portability until operational requirements exist

- Status: proposed
- Date: 2026-08-21
- Decision owners: product owner and operations owner
- Supersedes: none
- Superseded by: none

## Context

No production hosting target, budget, region, availability objective, backup
policy, or offline requirement has been approved. Choosing Vercel, a container
platform, or another managed service now would turn unknown operational
requirements into architecture by accident.

## Decision

Build and test Levi as a standard Next.js Node.js application backed by
PostgreSQL, without depending on provider-exclusive production features until a
deployment ADR is accepted.

The production selection must evaluate:

- Availability, latency, region, and data-residency requirements.
- Worship-service failure tolerance and offline/degraded behavior.
- PostgreSQL connectivity, migrations, backups, restore, and disaster recovery.
- Background work, scheduled work, file storage, logging, and monitoring.
- Preview environments, rollback, secrets, access control, and auditability.
- Expected usage, cost limits, and operational ownership.

The local application scaffold and CI are not blocked. Production infrastructure,
credentials, and deploy workflows are blocked until this ADR is accepted or
superseded.

Issue [#81](https://github.com/iwaseasahi/levi/issues/81) is the explicit human
decision record for the provider, region, managed PostgreSQL, backup/PITR,
secret store, monitoring, cost ceiling, and operational ownership. Preparing
repository runbooks does not resolve that Issue or authorize production work.

## Consequences

### Positive

- Keeps early implementation testable on local and CI environments.
- Avoids premature vendor coupling.
- Makes cost, reliability, and data handling explicit human decisions.

### Negative and risks

- Provider-specific optimizations are deferred.
- Portability constraints may exclude convenient proprietary features.
- Production readiness cannot be claimed before the deployment decision.

## Alternatives considered

### Select Vercel immediately

Vercel is a natural Next.js deployment option and Prisma documents the
integration. It is not selected yet because Levi's reliability, data, and cost
requirements are not defined.

### Select a container platform immediately

Containers provide portability and control but create operational ownership
before the required service level is known.

## Compatibility and version policy

The selected platform must support the pinned Active LTS Node.js runtime,
generally available Next.js and Prisma releases, PostgreSQL connections,
production migration controls, and the project's observability requirements.

## Reconsider when

- Operational requirements and an initial load profile are documented.
- A production-like walking skeleton can be deployed and measured.

## Verification

- Production build and start commands work in a clean Linux environment.
- Deployment proof of concept verifies migrations, health checks, logs, rollback,
  backup, and restore before acceptance.

## References

- [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting)
- [Prisma with Next.js and Vercel](https://www.prisma.io/docs/guides/frameworks/nextjs)
