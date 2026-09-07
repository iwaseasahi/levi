# Stabilize equal-timestamp Slide list E2E ordering

## Issue

- Issue: #486
- Branch: `codex/issue-486`
- Base commit: `5fa69f88c8fa4d4058860f47b10b7eec336df8c9`

## Outcome

Make the Slide cursor-pagination E2E fixture and assertions deterministic for
the production `(createdAt DESC, id DESC)` ordering contract, without retries or
weaker coverage.

## Plan

1. [x] Give the 24 equal-timestamp fixture Slides deterministic UUIDs.
2. [x] Assert exact first-page, second-page, and backward-navigation href order.
3. [x] Run the affected scenario within the full E2E suite three times.
4. [ ] Run canonical checks, review, commit, open a PR, and wait for exact-head
       protected CI.
5. [ ] Merge #486, update PR #494 from `main`, and complete its protected CI.

## Constraints

- Keep production ordering unchanged; the defect is in test fixture assumptions.
- Keep Playwright retries at zero.
- Preserve equal-timestamp cursor-boundary coverage and tenant isolation.
- Use only synthetic data and the disposable E2E database.

## Verification

- [x] Equal-timestamp Slide list E2E passed in all three full-suite runs
- [x] Full `pnpm test:e2e` passed 35/35 on runs one and three; run two passed
      the changed scenario and failed an independent sidebar interaction tracked
      by follow-up Issue #495
- [x] `pnpm check` passes
- [x] `pnpm test:integration` passes (26 files / 140 tests)
- [x] `pnpm security:check` passes (no high/critical finding; 356 licenses)
- [x] `git diff --check` passes
- [ ] Exact-head `Quality`, `Database`, `E2E`, and `Security` pass

## Handoff or blockers

- Completed: Issue intake, failure correlation with #494, isolated worktree, and
  writer lease, deterministic fixture/assertions, and three retries-zero full
  E2E runs, canonical checks, and follow-up Issue #495 for the independent
  sidebar interaction flake.
- Remaining: final review, commit, PR, and exact-head CI.
- Blocker: none.
- Resume with: review the complete diff and commit.

## Result

Pending.
