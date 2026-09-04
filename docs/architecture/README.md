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

| ADR                                                                 | Status     | Decision                                                 |
| ------------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| [0001](0001-full-stack-typescript.md)                               | accepted   | Next.js App Router, React, and strict TypeScript         |
| [0002](0002-prisma-postgresql.md)                                   | accepted   | Prisma ORM and PostgreSQL                                |
| [0003](0003-pnpm-and-version-policy.md)                             | accepted   | pnpm and explicit version pinning                        |
| [0004](0004-authentication-selection-gate.md)                       | superseded | Authentication selection gate                            |
| [0005](0005-deployment-selection-gate.md)                           | accepted   | WebARENA Indigo single-VPS production architecture       |
| [0006](0006-better-auth-database-sessions.md)                       | accepted   | Better Auth with database sessions and operator recovery |
| [0007](0007-normalized-data-model.md)                               | accepted   | Normalized ownership-specific relational models          |
| [0008](0008-single-operator-basic-auth.md)                          | accepted   | Basic authentication for the single platform operator    |
| [0009](0009-separate-administrator-identities.md)                   | accepted   | Separate administrator identities from Church users      |
| [0010](0010-admin-user-database-sessions.md)                        | accepted   | Database sessions inside the Basic admin boundary        |
| [0012](0012-admin-better-auth-email.md)                             | accepted   | Dedicated Better Auth and email for administrators       |
| [0013](0013-email-invitation-and-self-service-password-recovery.md) | accepted   | Email invitation and self-service password recovery      |
| [0014](0014-password-link-purpose-and-validity.md)                  | accepted   | Separate setup/recovery emails and three-day links       |
| [0015](0015-church-owned-slides.md)                                 | accepted   | Church-owned slides and transient presentation           |
| [0016](0016-store-slide-images-in-postgresql.md)                    | accepted   | Bounded Slide images stored in PostgreSQL                |

Implementation-level data rules are documented in
[`database-conventions.md`](database-conventions.md) and the accepted
[`data-model-dictionary.md`](data-model-dictionary.md).

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
