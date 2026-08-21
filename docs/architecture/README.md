# Architecture decisions

Architecture decisions for Levi are recorded as ADRs. Agents must read accepted
ADRs before making a material technical choice and must not silently override
them in implementation code.

## Status values

- **proposed**: under evaluation; implementation may explore but must not make
  the choice expensive to reverse.
- **accepted**: the current default for implementation.
- **superseded**: replaced by another ADR; retained for history.
- **rejected**: evaluated and not selected.

## Index

| ADR                                           | Status     | Decision                                             |
| --------------------------------------------- | ---------- | ---------------------------------------------------- |
| [0001](0001-full-stack-typescript.md)         | accepted   | Next.js App Router, React, and strict TypeScript     |
| [0002](0002-prisma-postgresql.md)             | accepted   | Prisma ORM and PostgreSQL                            |
| [0003](0003-pnpm-and-version-policy.md)       | accepted   | pnpm and explicit version pinning                    |
| [0004](0004-authentication-selection-gate.md) | superseded | Authentication selection gate                        |
| [0005](0005-deployment-selection-gate.md)     | proposed   | Portable deployment and selection gate               |
| [0006](0006-better-auth-database-sessions.md) | accepted   | Better Auth with database sessions and an email port |

Implementation-level data rules are documented in
[`database-conventions.md`](database-conventions.md).

Open product and operational decisions are tracked in
[`open-decisions.md`](open-decisions.md).

## Creating an ADR

1. Copy [`0000-template.md`](0000-template.md).
2. Use the next four-digit sequence number and a short outcome-oriented slug.
3. Link evidence and authoritative documentation.
4. State the consequences, rejected alternatives, compatibility constraints, and
   conditions that would cause reconsideration.
5. Update this index in the same pull request.

Changing an accepted decision requires a new ADR that supersedes the old one.
