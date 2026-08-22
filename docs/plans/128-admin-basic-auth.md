# Protect administration with single-operator Basic authentication

## Issue

- Issue: #128
- Branch: `codex/issue-128`
- Base commit: `41eff52b82cb41501b469ec88bc2f1df75975239`

## Outcome

`/admin/*` and its Server Actions require HTTPS Basic authentication backed
by a configured scrypt hash. Successful requests map to one deterministic,
credential-free internal platform-operator actor created by the database seed.
Church users continue to use Better Auth without behavior changes.

## Context

- `src/proxy.ts` already runs before all application routes and propagates a
  server-generated request ID.
- `src/infrastructure/auth/operator-session.ts` currently authorizes a Better
  Auth session by querying `platform_operators`.
- Provisioning and password reset re-check the operator actor inside their
  database transactions.
- The production model currently has one human Levi operator.

## Constraints

- Proxy challenges unauthenticated admin requests, while every Server Action
  independently verifies the same Basic credentials.
- Production accepts Basic credentials only over HTTPS.
- Store only the username and scrypt verifier in environment configuration.
- Generate the verifier through a hidden, TTY-only prompt; never accept the
  password via arguments or environment.
- Rate-limit failed authentication in PostgreSQL and fail closed on database or
  configuration errors.
- The seed creates no operator credential account.
- Production configuration, seed execution, and deployment remain separately
  approved operations.

## Non-goals

- Multiple operators, individual operator audit identities, or an admin logout UI.
- Changing church-user Better Auth.
- Running the change in production.

## Plan

1. [x] Add validated Basic-auth configuration, strict header parsing, scrypt verification, and PostgreSQL failure limiting.
2. [x] Protect admin routes in Proxy and independently authorize page/actions against the fixed internal operator.
3. [x] Add the deterministic credential-free operator seed and verification.
4. [x] Add the hidden password-hash command and operations runbook.
5. [x] Update unit, integration, and Chromium E2E coverage.
6. [ ] Run canonical verification and merge only after exact-head required CI succeeds.

## Progress

- 2026-08-22 JST — Replaced the uncommitted CLI-account design after the product owner selected Basic authentication.
- 2026-08-22 JST — Implemented the Basic boundary, fixed internal actor, atomic PostgreSQL failure counter, interactive verifier generator, and operating guidance.
- 2026-08-22 JST — Passed local Quality/build, Database, Integration, E2E, Security, and diff checks.

## Decisions

- 2026-08-22 — Keep church authentication on Better Auth and scope Basic authentication to `/admin/*`.
  - Reason: there is one operator, while church users still require revocable individual sessions.
  - Alternatives: create a Better Auth operator account; superseded by the product decision.
- 2026-08-22 — Map successful Basic authentication to a deterministic internal operator actor with no credential account.
  - Reason: existing use cases retain authorization and audit identifiers without duplicating the Basic password in the database.
  - Alternatives: remove operator data checks; rejected because it weakens defense in depth.

## Risks and mitigations

- Risk: Basic credentials are replayable and browsers cache them.
  - Mitigation: require production HTTPS, use a strong scrypt-verified password, document rotation/browser limitations, and rate-limit failures.
- Risk: Proxy coverage could be bypassed by a future route refactor.
  - Mitigation: Server Actions call the independent operator authenticator and tests exercise denied mutations.
- Risk: one shared operator prevents individual attribution.
  - Mitigation: document Basic auth as a single-operator constraint and migration trigger.

## Verification

- [x] `pnpm check`
- [x] `pnpm db:check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Final diff reviewed for credentials, private data, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation and local canonical verification.
- Remaining: PR, exact-head CI, merge, lease release, and synchronization.
- Blocker: none.
- Resume with: create the PR and wait for every required exact-head CI check.

## Result

Pending.
