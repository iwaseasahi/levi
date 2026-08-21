# Provision a church and its initial account from the operator UI

## Issue

- Issue: #43
- Branch: `codex/issue-43`
- Base commit: `fc8e8127eeca1ceeac65992999e7ed992f135823`

## Outcome

An authenticated active platform operator can create one Church, one pending
credential identity, and its membership through a protected administration UI.
The operation commits atomically, returns a generated temporary password once,
and leaves no login-capable partial account after any failure.

## Context

- ADR 0006 requires public sign-up to stay disabled, Better Auth scrypt hashes,
  a one-time temporary password, and forced password change.
- ADR 0007 and the Issue #42 migration enforce pending/active actor assignment,
  one account per Church, credential-only accounts, and normalized email.
- Better Auth 1.7.1's Prisma adapter accepts a Prisma transaction client. A
  route-inaccessible provisioning-only auth instance can call the library's
  email sign-up endpoint with public sign-up enabled while every write remains
  inside Levi's outer transaction.
- Next.js 16 requires authorization at every Server Action/Route Handler and
  recommends a server-only DAL close to the data source.

## Constraints

- Route rendering, mutation entry point, use case, and transaction-level data
  access each deny missing or non-operator identity.
- No password, session token, cookie, auth header, request body, email address,
  or raw exception is logged.
- Duplicate and persistence failures return one generic safe message; only
  field-shape validation is specific.
- The temporary password exists only in server memory and the single successful
  response. It is never persisted, logged, retrievable, or included in CI
  artifacts.
- Production secrets, initial production operator creation, deployment, and
  production migration remain human-gated.

## Non-goals

- Church-user login/logout UI and session revocation from Issue #44.
- Operator credential reset and church-user forced-change flow from Issue #45.
- Multiple accounts per Church, church roles, invitations, or outbound email.

## Plan

1. [x] Implement and test normalized provisioning input, cryptographically
       generated temporary passwords, session-to-actor resolution, and layered
       operator authorization.
2. [x] Implement the Better Auth-backed atomic transaction and prove success,
       duplicate, unauthorized, rollback, and retry behavior against PostgreSQL.
3. [x] Build the protected administration page and Server Action with loading,
       disabled, validation, server-error, success, one-time secret, keyboard,
       focus, and accessibility behavior.
4. [x] Add the Better Auth route boundary, synthetic operator E2E setup, and
       latest-Chrome allowed/denied workflow without exposing Restricted data.
5. [x] Document suspension, credential handoff/reissue operations, run all
       canonical checks, review the diff, and merge only the exact passing commit.

## Progress

- 2026-08-21 14:46 JST — Started after Issue #42 / PR #65 merged; read Issue
  #43, accepted auth/data ADRs, security policy, and Next.js 16 authentication,
  Route Handler, forms, and Server Action guidance.
- 2026-08-21 15:06 JST — Completed the atomic provisioning use case, protected
  operator UI, public auth boundary, one-time credential handling, lifecycle
  runbook, and PostgreSQL/component/latest-Chromium verification.

## Decisions

- 2026-08-21 — Decision: use one outer Prisma transaction and a private Better
  Auth instance bound to its transaction client for credential provisioning.
  - Reason: this uses Better Auth's supported password/account primitives while
    making Church, User, Account, and Membership one atomic commit.
  - Alternatives: the admin plugin would add unrelated role schema and a public
    route surface; compensation would be weaker than an available transaction.
  - ADR: implements ADR 0006 without changing it.
- 2026-08-21 — Decision: use a Server Action for the operator form and retain a
  server-only use case/DAL boundary underneath it.
  - Reason: Next.js 16 provides CSRF origin enforcement and direct pending/form
    state support, while authorization is still repeated inside the action and
    transaction.
  - Alternatives: a bespoke JSON route would duplicate form state handling.

## Risks and mitigations

- Risk: a private auth instance becomes reachable as public sign-up.
  - Mitigation: keep it in a server-only provisioning module, never export its
    handler, and test the public auth instance still rejects sign-up.
- Risk: retries create a second Church or reveal whether an email exists.
  - Mitigation: database uniqueness, one atomic transaction, a generic conflict
    result, and integration tests asserting exact row counts.
- Risk: the temporary password leaks through UI persistence or diagnostics.
  - Mitigation: return it only in successful action state, render it once with a
    clear handoff warning, clear it before the next submission, and prohibit it
    from logs/test artifacts.

## Verification

- [x] `pnpm test:unit` — 45 domain/config/authorization tests pass
- [x] `pnpm test:integration` — 19 atomicity and allowed/denied database tests pass
- [x] `pnpm test:component` — 6 form state, focus, keyboard, and accessibility tests pass
- [x] `pnpm test:e2e` — 4 latest-Chromium allowed/denied workflow tests pass
- [x] `pnpm db:check` — migration/drift/seed checks pass
- [x] `pnpm check` — format, lint, type, 51 tests, and production build pass
- [x] `pnpm security:check` — audit and 314 license records pass
- [x] `git diff --check` — no whitespace errors
- [x] Final diff reviewed for secrets, authorization gaps, unsafe errors, and
      partial-write paths

## Handoff or blockers

- Completed: implementation, documentation, and local verification.
- Remaining: exact-head GitHub CI and merge.
- Blocker: none.
- Resume with: publish the PR and merge only after all four required jobs pass.

## Result

An active platform operator can create a Church and its initial credential
identity atomically. Unauthorized callers and public sign-up are denied,
duplicates fail generically without partial rows, and the temporary password is
returned once without persistence, logging, or test artifacts. Reset and forced
password change remain explicitly assigned to Issue #45.
