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
4. [x] Run canonical and relevant operational checks, inspect the full diff and
       open/review PR #577.
5. [ ] Verify exact-head protected CI before merge; record the final run and merge
       SHA in PR #577.

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

- 2026-11-03 JST — `mise run check` passed:587 unit and129 component tests,
  deployment guards and build. Integration145/E2E35/security/backup rehearsal,
  `pnpm db:check`, release checklist dry run and whitespace checks passed.
  PR #577 is open. Final review found no scope, credential or approval changes;
  all3 retrieval pipelines retain `set -euo pipefail`, and the original latest
  check selection remains in place.

## Verification

- `mise exec -- corepack pnpm install --frozen-lockfile`: passed.
- `mise run check` (canonical `pnpm check`): passed.
- `pnpm exec tsx scripts/check-required-ci-pagination.ts`:27 cases passed;
  original implementation failed15 assertions in the initial24-case suite.
- `pnpm test:integration`:145 passed; `pnpm test:e2e`:35 passed, zero retries.
- `pnpm security:check`: passed;354 approved license records.
- `pnpm backup:rehearse`: passed, disposable local encrypted restore only.
- `pnpm db:check`: passed with loopback `levi_test` and `levi_shadow` URLs.
- `pnpm release:checklist:dry-run`: passed; no release performed.
- Read-only live wait-script check of the incident commit: passed.
- `git diff --check`: passed.
- Exact-head protected Quality/Database/E2E/Security: see PR #577 for final
  immutable run links and merge evidence; no merge is permitted before success.

## Risks and mitigations

- A partial API response must not authorize release: test a failed second-page
  request after the first page already contains successful required checks.
- An older success must not mask a newer failure: test results spread across
  pages in both orders.
- A merge does not replace trusted VPS files: prepare exact reviewed installation
  instructions; production installation/release remain separate approval-bound
  operations under `docs/governance/autonomy.md`.

## Handoff or blockers

- Completed: implementation,27 regression cases, local canonical and operational
  validation, full diff review and PR #577.
- Remaining: exact-head protected checks/merge, then separately approved
  installation of the merged source into the existing VPS bundle.
- Blocker: none for repository work. Host installation requires exact-target human
  approval under governance; it has not been performed.
- Resume with: `gh pr checks 577`.

## Result

Repository correction is prepared in PR #577. The operational rollout boundary
and existing installer/preflight procedure are documented in the release
runbook. GitHub workflow gates take effect on merge, while the installed VPS
wait script changes only after the explicitly approved host installation.
Production application, credentials, permissions and timers remain unchanged.
