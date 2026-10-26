# Unblock reviewed Dependabot updates without weakening Quality

## Issue

- Issue: #548; parent #547, originating policy #541.
- Branch: `codex/issue-548`
- Base: `6801eda6174b56c464207f2b49eb232681a9ba33`

## Outcome and constraints

Keep canonical formatting, exact SHA pinning, consistent CI runtimes/caches,
protected checks and deployment guards. Permit only explicitly reviewed Action
releases, and format generated lockfiles without changing their meaning.
No new dependencies, arbitrary SHA acceptance, ignored lockfiles, production
operations, workflow permission changes or forced pushes.

## Plan

1. [x] Read intake, parent evidence, governance, testing/CI/dependency policy and
       ADR 0003. Isolate the writer and inspect the actual assertions.
2. [x] Centralize the three reviewed Action pin pairs and preserve exact counts,
       uniform refs, release comments and rejection of unreviewed SHAs/tags.
3. [x] Prove negative/positive behavior with focused regression tests; run the
       existing local/deployment configuration checks and canonical checks.
4. [ ] Merge through exact-head protected CI, then update the existing Action PRs.
5. [ ] Apply format-only lockfile commits to the three dependency PRs in separately
       scoped repairs after the main prerequisites (#549 included) have merged.
6. [ ] Verify each updated PR's exact-head required checks and protected auto-merge.

## Decisions and evidence

- Existing checks embed one old Action SHA in several assertions. Replace that
  duplication with a small reviewed pin registry, not a permissive SHA pattern.
- Approved existing refs: pnpm/setup v2.1.0, docker/setup-buildx-action v4.3.0 and
  docker/build-push-action v7.3.0 (already in main).
- Official GitHub refs verified 2026-10-26: pnpm/setup v3.1.1 is an annotated tag
  peeled to a0881977cd8ea73b1ed212236c99ca10dcc80cf4; setup-buildx v4.4.1 resolves
  to f87e5991a6d7451dcb8d9637bfbc97413f497069; build-push v7.4.0 resolves to
  c3c9e263c25d99ce0380d002d59b67737d91b0dc. These match the open update PRs.
- All occurrences for each checked Action must still use one identical approved
  SHA/release pair. Wrong counts, mixed releases, short SHAs, tags, mismatched
  comments and unreviewed SHAs must fail.
- Lockfile repair uses the declared Prettier version with debug-check and frozen
  installation; do not exclude generated lockfiles from formatting. Retain the
  bot PRs and add scoped formatting commits after generation completes.
- Merge order: this main CI-check repair, then #549 accessibility/tool regression,
  then final dependency PR refresh/formatting. No concurrent workflow-scope writer.

## Progress / verification

- Implemented the reviewed registry with all existing runtime/deployment guards retained.
- `mise run check` passed: formatting, lint, typecheck, 587 unit tests,
  129 component tests, configuration guards and production build.
- 18 focused tests cover both reviewed versions, wrong counts, mixed releases,
  unreviewed/moving/short refs and missing/mismatched release comments.
- Temporary workflow mutation: all three approved updated refs passed existing
  local/deployment configuration checks; an unknown 40-character SHA failed.
  Original workflows were restored. `git diff --check` passed.

## Handoff or blockers

- Completed: intake, isolated branch/lease, upstream review, implementation and local checks.
- Remaining: protected merge and existing PR repairs.
- Blocker: none; #549 remains a separate prerequisite for #528's E2E.
- Resume with: verify protected CI for this branch, then merge and refresh Action PRs.
