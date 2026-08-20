# Product non-goals

These boundaries prevent the foundation phase from turning assumptions into
product scope. They may be changed only by an explicit product decision and, when
durable, an ADR.

## Foundation phase

Levi is not currently attempting to:

- Reimplement every Ginmaku 2 feature before validating the development harness.
- Claim feature parity without legacy evidence or an approved replacement
  decision.
- Select authentication from a login demo before identity and tenancy are known.
- Select production hosting before reliability, region, data, cost, and
  operational ownership requirements are known.
- Provide unattended production deployment or production database migration.
- Give coding agents production credentials, real personal data, or unrestricted
  external access.
- Introduce microservices, a public API, native applications, or offline storage
  without a measured requirement and ADR.
- Preserve a legacy behavior solely because it exists; each parity item must be
  classified as must, should, or won't.
- Optimize for hypothetical scale before representative workflows and performance
  objectives are available.

## Not implied by the selected stack

- Choosing Next.js does not decide the hosting provider.
- Choosing PostgreSQL does not decide the managed database vendor.
- Choosing Prisma does not allow database access from every UI module.
- Choosing TypeScript does not replace runtime validation or database
  constraints.
- Choosing a web architecture does not establish supported browsers, offline
  guarantees, or display topology.

## Revising non-goals

An Issue proposing a revision must identify the user outcome, evidence, cost,
risk, verification plan, and the ADR or product decision it changes.
