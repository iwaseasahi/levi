# Build the authentication and church database foundation

## Issue

- Issue: #42
- Branch: `codex/issue-42`
- Base commit: `1a3abd1518c6d22f1d23a331f85016e673e3ddf5`

## Outcome

Better Auth 1.7.1-compatible identity, credential, session, database rate-limit,
church, operator, and membership records are represented by the repository's
Prisma schema and immutable migration, with PostgreSQL constraints and tests
preventing invalid actor, tenant, credential, lifecycle, and deletion states.

## Context

- ADR 0006 selects Better Auth with database sessions, credential-only login,
  database-backed rate limits, and 30-day sessions.
- ADR 0007 and `docs/architecture/data-model-dictionary.md` define the normalized
  actor and tenant boundaries.
- Better Auth 1.7.1 candidate generation and installed package source require
  `Account.issuer`; credential rows use `local:credential` and account identity
  is unique by `(issuer, accountId)`.
- The existing reset guard limits destructive database operations to the local
  disposable `levi` and `levi_test` databases.

## Constraints

- Repository migrations are the source of truth; generated Better Auth schema
  is review input only.
- Password hashes, session tokens, verification values, and temporary passwords
  are Restricted and must not appear in logs or artifacts.
- Public sign-up, OAuth, cookie caching, disabled CSRF/origin checks, wildcard
  origins, and undeclared proxy trust remain unavailable.
- Only clearly resolved local disposable databases may be reset during migration
  rehearsal. No production migration, secret, or deployment action is in scope.

## Non-goals

- Operator provisioning UI and use case from Issue #43.
- Login/logout and session lifecycle routes from Issue #44.
- Password reset and forced-change workflow from Issue #45.
- Bible, bookmark, and folder tables owned by later child Issues.

## Plan

1. [x] Align the Prisma schema, ADR, dictionary, and migration with the exact
       Better Auth 1.7.1 account issuer and database rate-limit contract.
2. [x] Add configuration and database regression tests for accepted and denied
       authentication, actor, tenant, lifecycle, schema, and deletion states.
3. [x] Rehearse the immutable migration, seed, drift checks, and integration
       suite on newly created local disposable databases without resetting existing
       data.
4. [x] Run all canonical checks, inspect the final diff, and record verification
       on a pull request before merging the exact passing commit.

## Progress

- 2026-08-21 14:25 JST — Started from accepted ADRs and Issue #42; added pinned
  Better Auth dependencies, draft schema/migration, locked-down auth options,
  and initial configuration/database tests.
- 2026-08-21 14:25 JST — Better Auth 1.7.1 candidate generation exposed the new
  required `issuer` field; installed source confirmed credential issuer
  `local:credential` and lookup uniqueness by `(issuer, accountId)`.
- 2026-08-21 14:30 JST — `pnpm db:check` passed from an empty local database;
  all migrations, drift checks, deterministic seed, and verification passed.
- 2026-08-21 14:30 JST — Rehearsed the new migration from the previously merged
  schema in a separate local database; migration deploy passed.
- 2026-08-21 14:30 JST — `pnpm test:integration` passed 14 tests, including
  PostgreSQL catalog, credential, actor, cardinality, lifecycle, and delete-scope
  assertions.
- 2026-08-21 14:34 JST — `pnpm check`, `pnpm test:unit:coverage`, and
  `pnpm test:e2e` passed. `pnpm security:check` passed after reviewing and
  documenting the four newly resolved license groups; audit found no known
  vulnerabilities.
- 2026-08-21 14:36 JST — Final migration review found and fixed subtype
  reassignment validation; the deferred trigger now checks both old and new User
  IDs. Empty/previous-schema rehearsals and 14 integration tests passed again.
- 2026-08-21 14:42 JST — PR #65 passed Quality, Database, E2E, and Security on
  head `6c5bdc4`. Gitleaks exceptions contain only the two exact fingerprints for
  synthetic test fixture literals retained in the branch history; current
  fixtures construct low-entropy placeholders and the default rules remain
  enabled.

## Decisions

- 2026-08-21 — Decision: model `Account.issuer` explicitly and require
  `local:credential` in the initial credential-only database CHECK.
  - Reason: this is the installed Better Auth 1.7.1 storage and lookup contract.
  - Alternatives: provider-only account identity was rejected because the
    adapter no longer uses that key.
  - ADR: ADR 0007 amendment in this change.
- 2026-08-21 — Decision: persist Better Auth rate limits in a dedicated
  `rate_limits` table.
  - Reason: ADR 0006 requires cross-process database-backed login throttling.
  - Alternatives: in-memory limiting was rejected because it does not coordinate
    multiple processes.
  - ADR: ADR 0006 and ADR 0007 amendment in this change.

## Risks and mitigations

- Risk: Better Auth package updates silently change its storage contract.
  - Mitigation: pin exact versions, retain schema contract tests, and require
    generated-schema review for dependency updates.
- Risk: a cascade deletes a tenant rather than only identity-owned records.
  - Mitigation: integration tests delete both sides and assert the exact scope.
- Risk: Prisma cannot express every accepted PostgreSQL constraint.
  - Mitigation: named migration SQL constraints/triggers plus catalog and
    behavior tests.

## Verification

- [x] `pnpm db:check` — migration, drift, seed, and connectivity pass
- [x] `pnpm test:integration` — PostgreSQL behavior and catalog tests pass
- [x] `pnpm check` — format, lint, type, test, and build pass
- [x] `pnpm test:e2e` — Chromium walking skeleton passes
- [x] `pnpm security:check` — dependency audit and licenses pass
- [x] `git diff --check` — no whitespace errors
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: dependencies, exact installed-version schema alignment, migration,
  ADR/dictionary amendment, runtime configuration, unit/integration coverage,
  empty/previous-schema rehearsal, canonical local checks, final review, and PR
  verification.
- Remaining: protected merge of PR #65 after exact-head CI.
- Blocker: none.
- Resume with: review the complete patch and create the pull request.

## Result

Issue #42's database and configuration foundation is complete in PR #65. The
repository schema matches Better Auth 1.7.1's required issuer and rate-limit
contract, invalid identity/tenant states are rejected by PostgreSQL and tested,
and both empty-database and previous-schema migration rehearsals pass. Production
migration, provisioning, login/logout, and password-reset workflows remain in
their separately gated follow-up Issues.
