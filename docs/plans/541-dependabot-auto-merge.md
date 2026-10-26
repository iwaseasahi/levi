# Merge Dependabot PRs after protected CI succeeds

## Issue

- Issue: #541 (no parent or dependencies)
- Branch: `codex/issue-541`
- Base commit: `5639361`

## Outcome

Same-repository, non-draft Dependabot PRs targeting `main` automatically squash
merge after all required checks and branch protection pass, including major
updates. Existing open Dependabot PRs also receive an auto-merge request.

## Context and constraints

- `docs/ci.md`, `docs/security/dependency-policy.md`, ADR 0003 and governance apply.
- Repository auto-merge was disabled at intake. `main` requires Quality,
  Database, E2E and Security, strict up-to-date branches, linear history and zero
  human approvals; protection also applies to administrators.
- Do not weaken checks, add credentials/dependencies, run PR code with write
  permissions, or deploy to production.
- The user's request authorizes enabling repository auto-merge and requesting it
  for Dependabot PRs. Ordinary PRs remain opt-in.

## Plan

1. [x] Inspect GitHub settings, dependency policy and existing workflows; create
       the Issue, dedicated worktree and writer lease.
2. [x] Add a trusted-base workflow and synthetic-event regression coverage for
       eligibility and the protected squash auto-merge command.
3. [x] Document the scope, required settings, safety boundaries and rollback.
4. [ ] Run local validation, review the diff, create a PR and verify exact-head CI.
5. [ ] Enable repository auto-merge, merge the implementation after CI, request
       auto-merge for existing Dependabot PRs and verify settings/requests.

## Decisions

- Use GitHub native `gh pr merge --auto --squash` and existing branch protection.
  No automatic approval, administrative bypass, PAT or third-party action.
- Use `pull_request_target` without checkout or dependency installation. Only
  trusted inline shell reads event metadata and requests a merge for that exact
  head commit. The CLI receives PR data through quoted variables.
- Include all dependency update types, as requested. Conflicts, CI failures,
  missing checks and outdated branches remain blocked by GitHub.

## Progress

- 2026-10-26 JST — Intake complete; no matching open/existing auto-merge Issue.
  Created #541 and acquired the writer lease. No parallel workflow changes found.
- 2026-10-26 JST — Implemented the trusted-base workflow, 11 boundary regression
  cases and CI/dependency-policy documentation. The first `pnpm check` exposed a
  required `NODE_ENV` type in the isolated test environment; added `NODE_ENV=test`
  and reran the complete check successfully. Initial commands also exposed a
  shell runtime mismatch and shared modules metadata; switched to the pinned mise
  toolchain and a worktree-local frozen install.
- 2026-10-26 JST — Enabled native repository auto-merge under the user request and
  verified existing branch protection. Final CI and live activation evidence will
  be recorded in the linked PR after this commit is published.

## Verification

- [x] Synthetic allowed/denied events and exact CLI arguments: 11/11 tests pass.
      Temporarily removing the author guard fails the human-author case; restored
      the workflow and reran the suite successfully.
- [x] `actionlint` 1.7.12 (official release checksum verified),
      `mise run check` (`pnpm check`) and `git diff --check` pass.
      `mise exec -- corepack pnpm install --frozen-lockfile` also passes.
- [ ] Exact-head Quality / Database / E2E / Security.
- [x] Repository `allow_auto_merge=true`; verified all four required checks,
      strict mode, administrator enforcement and linear history remain unchanged.
- [ ] Existing Dependabot PR requests (activate after the implementation merges).

## Handoff or blockers

- Completed: implementation, local canonical checks, syntax and regression
  verification, native repository setting, and unchanged-protection verification.
- Remaining: exact-head PR CI, protected merge, existing PR enrollment and
  post-merge verification (tracked in the PR).
- Blocker: none.
- Resume with: inspect the linked PR CI; merge only when all required checks pass.
