# Cross-cutting church tenant isolation

## Issue

- Issue: #55
- Branch: `codex/issue-55`
- Base commit: `5702dd0`

## Outcome

Every church-owned operation receives a server-derived tenant scope and returns
the same non-disclosing denial for guessed, foreign, mixed, stale, suspended, or
operator identities, with automated evidence across application, repository,
PostgreSQL, logs, and latest Chrome.

## Context

- `src/application/auth/church-access.ts` is the identity-to-membership trust
  boundary, but currently exposes a raw `churchId` string.
- `src/application/saved-content/manage-saved-content.ts` requires a church ID
  on every repository call and `saved-content-repository.ts` scopes every query.
- ADR 0007 and Issue #54 already enforce composite Folder/Bookmark ownership.
- Existing auth, database, saved-content, and operator tests cover individual
  denied cases; this Issue adds one explicit cross-layer negative matrix.

## Constraints

- Browser-provided church IDs never create authorization context.
- Keep public denial bodies independent of whether a UUID exists.
- Use synthetic identities/content only; do not log content, credentials, email,
  or session material.
- Do not change the one-active-church-membership product model.
- Production access, secrets, migration, and deployment remain human gates.

## Non-goals

- Row-level security or a second database tenancy mechanism.
- Multiple memberships, roles, OAuth, audit-log storage, or production rollout.
- Timing padding without evidence of a measurable existence oracle.

## Plan

1. [x] Introduce a branded server-derived `ChurchScope` and require it across
       church-owned use-case/repository interfaces.
2. [x] Add a cross-layer negative integration matrix for guessed/foreign/mixed
       identifiers and pending/suspended/operator/stale actors.
3. [x] Add latest-Chrome/API denied cases proving uniform status/body behavior
       without exposing target data.
4. [x] Harden log redaction and update threat model/data classification/security
       review evidence.
5. [ ] Run all local gates, pass exact-commit CI, and merge.

## Progress

- 2026-08-21 19:35 JST — Started automatically after Issue #54 merged; read the
  Issue, ADR 0007, governance, testing, threat model, and data classification;
  acquired the writer lease and audited current tenant predicates.
- 2026-08-21 19:42 JST — Added the branded scope boundary, uniform
  foreign/guessed/mixed identifier denials, pending/operator/suspended/stale
  actor evidence, an allowlisted structured-log policy, and the durable security
  checklist. Unit 132, integration 71, and Chrome E2E 10 tests pass.
- 2026-08-21 19:42 JST — The first E2E layout added two independent logins and
  exhausted the existing database-backed login limit under parallel execution.
  Removed those extra logins and integrated the denied case into an existing
  authenticated flow; no retry or rate-limit weakening was introduced.

## Decisions

- 2026-08-21 — Decision: use a branded scope object created only by the church
  access resolver, rather than passing raw IDs through application interfaces.
  - Reason: this makes an omitted trust-boundary step visible to TypeScript while
    preserving the existing PostgreSQL/composite-FK defense in depth.
  - Alternatives: raw string conventions are too easy to misuse; PostgreSQL RLS
    is a separate durable architecture choice and is outside this Issue.

## Risks and mitigations

- Risk: a developer can still bypass a TypeScript brand with an explicit cast.
  - Mitigation: negative repository/API tests and query predicates remain the
    runtime controls; the brand is an additional guard, not authorization alone.
- Risk: timing assertions become flaky and create false confidence.
  - Mitigation: prove foreign and nonexistent identifiers execute the same
    scoped lookup and yield byte-equivalent public responses; do not assert wall
    clock thresholds without a reproducible oracle.

## Verification

- [x] `pnpm test:unit` and `pnpm test:integration`
- [x] `pnpm test:e2e` denied tenant scenarios
- [ ] `pnpm security:check` and `pnpm check`
- [ ] Exact-head `Quality`, `Database`, `E2E`, and `Security` CI
- [ ] Final diff reviewed for scope, secrets, logs, and unsafe defaults

## Handoff or blockers

- Completed: branded scope, negative matrix, log/docs hardening, and E2E.
- Remaining: full local gates, exact-head CI, and merge.
- Blocker: none.
- Resume with: run the complete local gate set, commit, open the draft PR, and
  wait for exact-head CI before merge.
