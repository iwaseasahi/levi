# Complete browser acceptance for Slide delivery

Issue #390 / parent #59 and #38. Branch `codex/issue-390`, base `1b87fef`.
Writer lease acquired. #385/#387/#389 merged; #388 passed local 132 integration /
30 E2E and its required CI is running. Prepare acceptance in this isolated branch;
merge its completed audit from main before final checks, PR and parity sign-off.
Read Slide contract, testing, governance and current migration evidence.

## Plan

1. [x] Run one real-browser lifecycle from creation/preview through literal search,
       projection, edit/reopen and physical deletion; prove drafts do not project.
2. [x] Verify keyboard/IME/focus, retry and real concurrent edit conflict without
       weakening existing pagination, accessibility or two-window recovery tests.
3. [x] Incorporate completed dependencies, full check/integration/E2E/security and
       focused visual review; map every criterion to executable evidence.
4. [ ] Only after evidence succeeds, mark SLIDE parity verified and open PR;
       exact-head required CI, merge, update #59 children and report outcome to #38.

## Constraints

Synthetic fixtures only; latest project-pinned Chromium; retries zero; observable
state waits. No production deploy/migration, real import, history or provider.
#397 originally owned search performance and later removed that unused API;
#302 Sunday measurements remain an explicit follow-up.

## Verification progress

- Incorporated merged #388 from main (`fee524e`) before final acceptance.
- `pnpm test:e2e`: 32/32 passed, retries zero. Full create/search/project/edit/delete
  lifecycle, protected draft preview, composed vs ordinary arrows, focused delete
  cancellation and actual two-editor 409 input retention passed. Initial retry
  fixture matched only one StrictMode request (trace: 503 then 200); kept the
  synthetic outage active until explicit Retry. No application retry added.
- `pnpm check`: 438 unit / 92 component, format/lint/types/config/build passed.
  `pnpm test:integration`: 132/132 passed. `pnpm security:check`: no known
  vulnerabilities, 315 approved production licenses. Unit coverage: lines 94.71%,
  branches 86.75%. `pnpm backup:rehearse`: passed, 5 seconds, all sessions cleared,
  Slide deletion replay and compatible archive checks; only disposable databases.
- Visually inspected final 390px controller and Japanese audience screenshots;
  existing geometry/axe checks cover all specified sizes and long/short text.
- Marked SLIDE parity verified only after these local gates. Final PR exact-head
  CI and merge are still required; no production release is claimed.
- Separate review: changes limited to acceptance tests/docs, no credentials or
  real content/artifacts committed, no unsupported dependency/permission change.
  Existing canonical suite preserved. Final GitHub reporting follows merge.
