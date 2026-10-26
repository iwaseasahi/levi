# Restore the dependency security gate for Dependabot automation

## Issue

- Issue: #543, prerequisite for #541 / PR #542
- Branch: `codex/issue-543`
- Base commit: `5639361`

## Outcome and scope

Resolve existing high advisories in undici 8.10.2 and zod 4.5.2 with the smallest
fixed releases in their existing major lines. Keep dependency audit thresholds,
license policy and branch protections intact. No new dependencies, application
behavior changes, moderate-advisory remediation or production operations.

## Evidence and decisions

- PR #542's unchanged dependency graph failed Security for
  GHSA-xjj6-f33q-929c (undici, 7.5) and GHSA-mrhx-c7xc-m3w5 (zod, 8.2).
- Official GitHub advisories specify undici 8.12.2 and zod 4.6.6 as fixed.
- npm metadata identifies the existing official repositories, MIT licenses,
  SHA-512 integrity values and SLSA provenance attestations for both releases.
  undici requires Node >=22.19.0, compatible with the pinned Node 24.22.1.
- Update the existing undici workspace override and direct Zod exact pin, with a matching
  Zod override for Better Auth’s independently locked vulnerable dependency; preserve all
  unrelated dependency versions and existing checks. Revert the version/lockfile
  change only if needed for compatibility, recognizing it restores known risk.

## Plan and progress

1. [x] Read #543, prerequisite #541, AGENTS.md, governance, ADR 0003, testing and
       dependency policy. Create a separate worktree and writer lease. Merge this
       prerequisite before touching the exclusive workflow scope again.
2. [x] Update exact pins and lockfile; document advisory and supply-chain evidence.
3. [x] Run frozen install, security/license checks and canonical `pnpm check`.
4. [ ] Create a PR and verify exact-head Quality / Database / E2E / Security.
5. [ ] Merge through protection, then resume #541 with current main.

## Progress

- 2026-10-26 JST — Updating only the direct Zod dependency left Better Auth’s
  independently locked 4.5.2 in the production graph. The unchanged audit gate
  detected it; added an exact Zod override to cover that existing dependency.

## Verification

- [x] Frozen install and minimal dependency diff: only undici 8.10.2 → 8.12.2
      and Zod 4.5.2 → 4.6.6 package versions change; peer graph keys follow Zod.
- [x] `pnpm security:check`: no high/critical findings; 356 approved license
      records, with no audit exceptions or license-policy changes.
- [x] `mise run check` (`pnpm check`): 552 unit tests, 129 component tests,
      formatting, lint, types, configuration guards and production build pass.
      `git diff --check` passes.
- [ ] Exact-head protected CI (including integration, E2E and coverage).

## Handoff or blockers

- Completed: minimal dependency update; official metadata and available provenance
  attestations checked (undici published October 15, Zod October 11); frozen
  install, security/license checks, canonical checks and final diff review pass.
- Remaining: exact-head protected CI, merge and resume #541, tracked in the PR.
- Blocker: none.
- Resume with: inspect the linked PR’s required checks and merge only when green.
