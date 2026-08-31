# Prepare implementable slide delivery after the first release

## Issue

- Issue: #59; parent #38; dependencies #57 and #58 (closed)
- Branch: `codex/issue-59`
- Base commit: `7732f035517bb1b9f98b982026639b7d4ecafa6a`

## Outcome

Reconfirm legacy slide behavior, decide the replacement contract, and create
bounded child Issues for schema, CRUD, search, pagination, projection, tenant
security, E2E, and migration assessment. This Issue delivers the decomposition;
child Issues deliver the running feature. No runtime or schema change here.

## Context and constraints

Read AGENTS.md, governance/execution and agent protocols, ADR 0007, database
conventions, release specification, projection protocol, migration inventory,
evidence policy, data classification, testing and CI contracts. Read #38, #57,
#58, #279, #280, #302 and #370. Legacy source was inspected read-only at
`4b18adb02ac8011630c76137c60038e168f05534`; no legacy app or data was run.

Physical deletion, no history, church ownership, and shared two-window
presentation are confirmed scope. Existing scripture behavior must survive.
No songs, PDFs, legacy content import, production operations, or dependencies.

## Plan

1. [x] Verify dependency/release evidence and current projection implementation.
2. [x] Record pinned legacy evidence and page/search/preview examples.
3. [x] Define Slide ownership/storage and presentation boundaries in an ADR.
4. [x] Create scoped child Issues with dependencies and verification criteria.
5. [ ] Update parity and specification links, run applicable checks, review diff.
6. [ ] Open PR, verify exact-commit CI, merge, and verify Issue status.

## Decisions

- 2026-08-31 — Follow #59's explicit decomposition Outcome; do not implement
  every child feature in a single PR.
- 2026-08-31 — Re-evaluation uses the recorded post-release workflow in #279,
  current source, and regression evidence. #302's future Sunday traffic remains
  unmeasured; do not imply capacity or latency proof from source or smoke tests.
- Detailed contract and differences from legacy belong in the product contract
  and ADR 0015, not only this plan.

## Progress

- 2026-08-31 JST — Inspected dependencies, clean main, public pinned legacy
  source, post-release evidence and current direct-audience code. Created an
  isolated worktree and acquired the Issue writer lease for 120 minutes.

- 2026-08-31 JST — Added the pinned source contract, ADR 0015, acceptance map,
  and native child Issues #382–#390. Verified all nine parent links via GitHub
  API. Eight synthetic page cases passed the legacy Ruby splitting expression;
  nine local contract links resolved. Runtime parity remains not-started.
- 2026-08-31 JST — Initial frozen install failed because the shell PATH lacked
  Node for package lifecycle subprocesses. Retried with the existing bundled
  Node 24.19.0 on PATH; frozen install passed without dependency changes.

## Verification

- [x] Acceptance criteria mapped to contract and child Issues.
- [x] Local documentation links and golden examples checked.
- [ ] `pnpm format:check`, `pnpm check`, `git diff --check`.
- [ ] Protected Quality, Database, E2E and Security on PR head.
- [ ] Final diff reviewed for scope, secrets, deletion and compatibility.

No new runtime behavior or database migration is introduced. Database/E2E
regression is retained through required CI; slide behavioral tests belong in
child implementation Issues rather than documentation-mirroring tests here.

## Handoff or blockers

- Completed: intake, isolation, contract/ADR, parity links and nine child Issues.
- Remaining: finish pnpm check, independent diff review, PR and exact-head CI.
- Blocker: none.
- Resume with: inspect /tmp/levi-59-check.log and create the documentation PR.

## Result

Pending.
