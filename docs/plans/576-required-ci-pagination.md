# Read every page before deciding required CI

## Issue

- Issue: #576; related release/notification Issues #563 and #566.
- Branch: `codex/issue-576`
- Base commit: `edd58b5e2ea36a6550ffdc08dbaed3c4040991cf`

## Outcome

All three production release gates find required checks beyond the first 100
results and still refuse failed, pending, missing or unreadable evidence.

## Context and constraints

The November 3 scheduled release stopped during CI confirmation with exit75.
The wait script and both production workflows read only the first Checks API
page. ADR0018 and ADR0019 require exact-commit CI and independently installed
root-owned VPS code. Follow governance, `docs/ci.md` and `docs/testing.md`.
Keep compatibility with the installed gh2.45.0 and use synthetic fixtures only.
No dependencies, runtime application, migration, approval or permission changes.

## Plan

1. [x] Read related Issues, governance, release ADRs/runbooks and existing guards;
       create Issue/worktree/writer lease.
2. [x] Add subprocess regressions for all three real gate bodies and demonstrate
       failure against the existing single-page implementation.
3. [x] Aggregate every page, preserving newest-result selection and API failures;
       document the explicit VPS installation required after merge.
4. [ ] Run canonical and relevant operational checks, inspect the full diff,
       open/review the PR and verify exact-head protected CI before merge.

## Progress

- 2026-11-03 JST — Started from a clean main. Confirmed the installed VPS bundle
  remains7124e8f and gh2.45.0. Selected `gh api --paginate` with external `jq -s`
  instead of relying on newer CLI aggregation flags.
- 2026-11-03 JST — Added 24 synthetic subprocess cases across the wait script and
  actual embedded workflow gate bodies. The unchanged implementation failed15
  assertions: later-page successes were missed, while later failure/pending/API
  errors could be ignored. Implemented full-page aggregation at all three gates.

- 2026-11-03 JST — All 27 current subprocess cases pass, including a newer success
  after an older failure. A read-only live check of the incident commit now
  succeeds. Integration tests, 35 Chromium E2E cases, security/license checks and
  the disposable encrypted backup rehearsal passed. The first full check exposed
  a missing NODE_ENV in the new test environment; corrected it and restarted the
  canonical check. No production files or deployment state changed.

## Verification

- Pending: regressions, `pnpm check`, integration/E2E/security/backup checks,
  `git diff --check` and exact-head Quality/Database/E2E/Security.

## Risks and mitigations

- A partial API response must not authorize release: test a failed second-page
  request after the first page already contains successful required checks.
- An older success must not mask a newer failure: test results spread across
  pages in both orders.
- A merge does not replace trusted VPS files: prepare exact reviewed installation
  instructions; production installation/release remain separate approval-bound
  operations under `docs/governance/autonomy.md`.

## Handoff or blockers

- Completed: intake, isolated worktree and writer lease.
- Remaining: regression, implementation, validation and PR handoff.
- Blocker: none for repository work.
- Resume with: `pnpm exec tsx scripts/check-required-ci-pagination.ts`.
