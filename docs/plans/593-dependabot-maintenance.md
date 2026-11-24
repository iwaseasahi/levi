# Restore November 24 Dependabot protected merges

## Issue and scope

- Issue: #593, following #578/#587/#588 and security prerequisite #592 / #594.
- Writer branch: `codex/issue-593`; one shared lease and disposable worktree.
- Current-main base: `ae33b1bc57c7a562bf90a119c5b9ce2dfcf556ab`.
- Outcome: repair and merge #589, #591 and #590 sequentially with exact-head CI.
- Constraints: preserve bot history, required checks, strict main protection,
  security/license gates and declared toolchain. No API billing, force pushes,
  production operations, migrations, credentials or schedule changes.

## Plan

1. [x] Read policies, previous Issues, current paginated PR/check state and logs.
2. [x] Merge shared effect security fix #594 through all four protected checks.
3. [x] Acquire shared writer lease and isolate issue branch/worktree.
4. [ ] Repair #589 with only the independently reviewed Action SHA/release pair.
5. [ ] Repair #591 using its declared Prettier 3.10.1; merge from latest main.
6. [ ] Repair #590 using the resulting declared formatter; merge latest main.
7. [ ] Verify each final head/check/merge, update Issue evidence and release lease.

## Diagnosis and attempt ledger

- #589 initial `9c23296e1bfcfa6f6c6e7c6569c15814594c8e1e`: Quality rejects
  unreviewed pnpm/setup v3.2.0; Security rejects effect 3.20.0. Attempt 1:
  integrate current main (fixed effect), register the verified explicit pin.
- #591 initial `5602b5b2b7a66fbdfb7c0f792e2b86f27c1d4898`: Prettier lockfile
  formatting; same shared Security failure. No repair attempt yet.
- #590 initial `cd022f1bc79369fec5878a7dcc8b989aba1144c0`: same formatting and
  shared Security failures. No repair attempt yet.
- Database/E2E initially passed for all three; running checks are never retried
  as failures. Maximum two repair attempts per PR in this run.

## Action provenance and compatibility review

Official pnpm/setup signed annotated tag `ab48ae04e3ab426a6ee9c1e34c4063ddc5db3405`
peels to `731dfb6463bbd11c11fd0ee11fe00ed0e36d48a1`, matching #589. GitHub
signature verification is valid; immutable v3.2.0 release published November 12.
Reviewed action.yml and installer/cache/version-selection source changes:
Node24 action runtime and explicit runtime/cache/install inputs remain compatible.
The existing exact packageManager pin still selects pnpm 11.19.0. New executable
caching uses platform/architecture/exact-version keys, saves verified downloads
before execution, validates restored executable version and retains signed npm
downloads on cache miss. get-pnpm now owns project-pin discovery. Hosted-runner
required CI validates actual setup, including the new executable cache path.
Only this SHA/release pair is added; unknown SHA/tag/comment/count/mixed-release
rejection and old approved pins remain intact.

## Verification and review

Exact commands/results, dependency compatibility review, semantic lockfile checks
and each final protected head/run/merge are maintained in #593 and each bot PR.
The final independent review checks complete diffs against Issue/ADR 0001–0003,
security policy and current evidence. No migration is expected.

## Remaining work

Finish local Action guards and protected CI, then update the two dependency PRs
sequentially. Final evidence updates this historical plan snapshot in #593.
