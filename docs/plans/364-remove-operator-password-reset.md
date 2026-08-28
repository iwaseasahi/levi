# Issue #364: Remove operator-managed church password reset

## Goal

Remove the platform-administration workflow that issued a temporary password
for a church user. Church users and administrators continue to recover their
own passwords through the 24-hour email reset flows.

## Base

- Branch: `codex/issue-364`
- Base: `db8f672f057ed047735ba0a01ecd4fdbb854f5ed`

## Plan

- [x] Inspect the administration routes, password lifecycle, tests, and current
      authentication documentation.
- [x] Remove the administration navigation, route, form, action, and dedicated
      manual-reset application/infrastructure code.
- [x] Update tests to prove the old route is absent while self-service reset
      remains available.
- [x] Reconcile product, security, testing, and architecture documentation with
      the email self-service policy.
- [x] Run targeted checks and the full canonical check suite.
- [ ] Open a pull request, wait for all required checks, merge, and close Issue
      #364.

## Progress

- 2026-08-29: Issue created, branch and writer lease acquired, relevant
  governance, Next.js, authentication, and test documentation reviewed.
- 2026-08-29: Removed the operator-managed reset surface and its dedicated
  application/database path. Kept the church-user and administrator email
  recovery routes with 24-hour links.
- 2026-08-29: `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`,
  `pnpm security:check`, and `git diff --check` passed.
