# Allow administrators to invite multiple users to one church

## Issue

- Issue: #357
- Branch: `codex/issue-357`
- Base commit: `5ce571da61facc1bd353cfac8145b10012acab85`

## Outcome

An authenticated administrator can invite another user to an existing active
church. Multiple users can authenticate independently while sharing the same
church scope and church-owned data.

## Context

- ADR 0007 intentionally made this expansion possible by removing only the
  unique constraint on `church_memberships.church_id`.
- Church provisioning already creates a pending Better Auth credential and
  sends the 24-hour password-setup email.
- The church directory currently projects a singular membership and user.

## Constraints

- A user continues to belong to exactly one church.
- Platform administrators remain separate from church users.
- The target church is resolved and authorized on the server.
- A failed email delivery must not leave an unusable pending identity.
- Production deployment and production migration are outside this Issue.

## Non-goals

- Multiple memberships for one user.
- Church roles or permissions.
- User deletion, suspension, or membership transfer.

## Plan

1. [x] Expand the membership schema and documentation while preserving the
       unique user-membership constraint.
2. [x] Add an authorized existing-church invitation use case with transactional
       rollback when invitation delivery fails.
3. [x] Add church-directory and invitation UI states with component coverage.
4. [x] Add integration and E2E evidence for two users in one church and denied
       cases.
5. [ ] Run canonical checks, review the migration/diff, and merge only after all
       protected CI checks pass.

## Progress

- 2026-08-28 19:35 JST — Started; inspected ADR 0007, the membership schema,
  church provisioning, directory UI, authentication policy, and testing
  strategy.
- 2026-08-28 20:20 JST — Removed the church-side membership uniqueness,
  implemented the existing-church invitation use case and UI, changed the
  directory to list every member, and refactored operator password reset to
  identify a user rather than assume one user per church.
- 2026-08-28 21:15 JST — Added migration, application, component, integration,
  and E2E coverage. Verified two independently authenticated users share one
  church scope, invitation failures roll back pending identities, and invalid or
  unauthorized targets are rejected.
- 2026-08-28 21:45 JST — Completed the canonical local checks and reviewed the
  final migration and authorization boundaries. Production deployment remains
  explicitly outside this Issue.

## Decisions

- 2026-08-28 — Decision: retain unique `user_id` and remove only unique
  `church_id` from ChurchMembership.
  - Reason: this enables the requested one-church-to-many-users cardinality
    without changing tenant resolution or church-owned data.
  - Alternatives: many-to-many user membership is outside the requested scope.
  - ADR: `docs/architecture/0007-normalized-data-model.md`

- 2026-08-28 — Decision: reuse the existing Better Auth password-reset email as
  the invitation acceptance flow.
  - Reason: it already provides a secret-free UI, 24-hour expiry, activation,
    and password setup.
  - Alternatives: temporary password sharing remains prohibited.

## Risks and mitigations

- Risk: membership cardinality changes could weaken tenant isolation.
  - Mitigation: preserve unique `user_id`, keep server-derived ChurchScope, and
    add database and E2E tests with two users sharing one church.
- Risk: email failure could orphan a pending user.
  - Mitigation: physically remove the newly created pending user and cascading
    membership/account records when delivery fails.

## Verification

- [x] `pnpm test:unit` — 57 files, 291 tests passed as part of `pnpm check`.
- [x] `pnpm test:component` — 18 files, 63 tests passed as part of `pnpm check`.
- [x] `pnpm test:integration` — 18 files, 90 tests passed.
- [x] `pnpm test:e2e` — 19 tests passed.
- [x] `pnpm check` — passed, including formatting, lint, typecheck, tests,
      configuration validation, and production build.
- [x] `git diff --check`
- [x] Acceptance criteria recorded in Issue #357
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation and local verification.
- Remaining: protected GitHub CI and merge.
- Blocker: none.
- Resume with: create the pull request and wait for Quality, Database, E2E, and
  Security.

## Result

One active church can now own multiple memberships. An authenticated platform
administrator can invite an additional user from the church directory through
the existing 24-hour Better Auth password-setup email flow. Church sessions
remain server-scoped, each user remains unique to one church, directory and
password-reset flows operate per user, and invitation delivery failures remove
the pending identity.
