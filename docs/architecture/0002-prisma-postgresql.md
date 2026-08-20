# ADR 0002: Use Prisma ORM with PostgreSQL

- Status: accepted
- Date: 2026-08-21
- Decision owners: repository owner and architecture maintainers
- Supersedes: none
- Superseded by: none

## Context

Levi needs durable relational data, explicit constraints, reproducible schema
changes, and a model that coding agents can inspect. The database layer must
support migration rehearsal, integrity checks, transactions, and future data
migration from Ginmaku 2.

PostgreSQL provides mature relational behavior and a documented multi-year
support policy. Prisma provides a concise schema, generated TypeScript types,
database migrations, and an officially documented Next.js integration.

## Decision

Use PostgreSQL as Levi's system-of-record database and Prisma ORM as the default
schema, migration, and application data-access layer.

Keep Prisma access inside infrastructure or repository modules rather than
calling it freely from UI components. Domain rules must not depend on generated
Prisma types when a stable domain type is more appropriate.

Use the current generally available Prisma major release. Do not adopt Prisma
Next or another early-access database layer for production foundations.

## Consequences

### Positive

- The schema provides a compact source of truth for models and relations.
- Generated types connect schema changes to TypeScript compiler feedback.
- PostgreSQL constraints and transactions protect relational integrity.
- Migration files can be reviewed, rehearsed, and verified in CI.

### Negative and risks

- Generated clients and migrations add tooling and lifecycle steps.
- ORM abstractions do not remove the need to understand SQL, indexes, locks, and
  query plans.
- Unsafe migrations can still lose data or cause downtime.
- Advanced PostgreSQL features may require raw SQL with additional tests.

## Alternatives considered

### Drizzle ORM

Drizzle offers a thin, SQL-oriented TypeScript layer with high query control. It
was not selected because Levi initially values a compact declarative schema and
an established migration/client workflow over minimizing abstraction. Reconsider
if Prisma repeatedly blocks required PostgreSQL behavior or produces unacceptable
runtime or deployment costs.

### SQLite

SQLite simplifies local deployment but does not match the initial multi-user,
server-backed system-of-record assumption. It remains suitable for isolated
tools or tests only when behavior matches PostgreSQL and the divergence is
explicit.

## Compatibility and version policy

- Use a PostgreSQL major version under upstream support and the current minor
  release for that major.
- Pin the development/test PostgreSQL major version and rehearse upgrades before
  changing it.
- Use a generally available Prisma release that supports the selected Active LTS
  Node.js and PostgreSQL versions.
- Follow the current Prisma driver-adapter and ESM requirements rather than
  copying configuration from an older major version.

## Reconsider when

- Measured queries require features Prisma cannot safely express.
- Deployment constraints make the Prisma runtime unsuitable.
- The system-of-record or offline architecture changes materially.

## Verification

- Apply every migration to an empty database in CI.
- Rehearse migrations from the previous schema with representative synthetic
  data.
- Detect schema drift and uncommitted generated output.
- Test constraints, transactions, allowed and denied data-access paths, and
  migration failure recovery.

## References

- [Prisma ORM system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)
- [Prisma with Next.js](https://www.prisma.io/docs/guides/frameworks/nextjs)
- [Prisma supported databases](https://www.prisma.io/docs/orm/reference/supported-databases)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
