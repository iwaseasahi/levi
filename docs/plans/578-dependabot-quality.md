# Restore November Dependabot updates through protected CI

## Issue

- Issue: #578; follows #548 and #541.
- Branch: `codex/issue-578`
- Base: `c548853070cec41eabbbef99184b332271dae259`

## Outcome and constraints

Repair #572–#575 and verify all four required checks on each final head before
their existing native auto-merge requests complete. Preserve all formatting,
frozen-install, supply-chain, runtime, pin consistency and branch-protection
guards. No production operations, permissions changes, new dependencies,
arbitrary pin acceptance or force pushes.

## Context

Read governance/execution protocol, PLANS.md, agent protocol, CI/testing and
dependency policy, ADR 0003, product vision and Issues #548/#547/#541.
The repository already defines manual lockfile formatting and an explicit reviewed
Action registry; these failures need the existing maintenance process.

- #572: Quality run 41563269992 rejects the unregistered pnpm/setup v3.1.2 pin.
- #573/#574/#575: Quality runs 41444484327/41444524493/41444678629 fail Prettier
  on the generated lockfile. Database, E2E and Security passed on those heads.

## Plan

1. [x] Inspect failures, upstream changes and governing maintenance policy;
       create the issue-scoped worktree and acquire the single-writer lease.
2. [x] Add only the verified pnpm/setup v3.1.2 SHA to the registry. Existing
       table-driven tests cover the new release and rejection boundaries.
3. [x] Run pin regressions, local configuration checks with old/new pins,
       canonical checks and diff review; prerequisite CI is running in #579.
4. [ ] Refresh #572 and verify its exact-head protected checks and merge.
5. [ ] Sequentially refresh and format #573/#574/#575 in separate maintenance
       worktrees, verify debug-check and frozen installs, then exact-head CI.
6. [ ] Record final merged states and remaining risks, release the lease and
       synchronize main.

## Decisions and evidence

- 2026-11-04 JST: official signed annotated tag `v3.1.2`, object
  `52b80fdb2795ea4948978d5a60f661bdd6fb2bf9`, peels to commit
  `fa36a5ef7dcdefc3a7cb25655c122e00cf6e636e`; GitHub reports signature valid.
  Source: <https://github.com/pnpm/setup/releases/tag/v3.1.2> and official Git refs.
- Reviewed upstream compare v3.1.1...v3.1.2: get-pnpm 0.0.6 download/version
  resolution, bounded verification-cache saving, store-cache fingerprinting,
  lockfileDir support and noisy runtime/cache output parsing. Existing
  `runtime: node@24.22.1`, `cache: true`, `install: false` inputs retain their
  contract; the explicit frozen install remains a separate step. No action input
  or workflow permission changes are needed.
- Retain earlier reviewed releases during independent PR merges. Unknown refs,
  mismatched comments, wrong counts and mixed pins remain rejected. Future
  releases require another explicit upstream review.
- Format bot lockfiles only after refreshing from main, using each PR's declared
  Prettier version, debug-check and frozen install. Append commits without
  rewriting bot history, as documented in docs/ci.md.

## Verification

- [x] `pnpm install --frozen-lockfile` (via `mise exec -- corepack`)
- [x] Focused `src/operations/github-action-pins.test.ts` — 19 passed
- [x] `pnpm local:config:check` with old and verified new pins
- [x] `mise run check` — passed: formatting, lint, typecheck, 588 unit /
      129 component tests, configuration guards and production build
- [x] `git diff --check` and separate final diff review
- [ ] Exact-head Quality / Database / E2E / Security for prerequisite and bot PRs

## Progress

- 2026-11-04 JST — Failure causes confirmed from CI logs, upstream tag/changes
  reviewed, lease acquired, explicit registry entry implemented.

## Handoff or blockers

- Completed: intake, failure diagnosis, upstream review, isolated registry repair.
- Remaining: protected merge and sequential bot PR repairs.
- Blocker: none.
- Resume with: verify #579 protected CI, merge, then refresh the bot PRs.

- 2026-11-04 JST — Local verification passed. Direct `pnpm` initially selected
  globally installed 11.25.0 and correctly failed the engine guard; all checks
  then used the repository-prescribed `corepack pnpm` 11.19.0 through mise.
