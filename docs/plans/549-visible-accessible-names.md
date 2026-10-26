# Match accessible names to visible projection and Slide labels

## Issue / scope

- Issue #549; parent #547; Quality prerequisite #548.
- Branch `codex/issue-549`, base `6801eda6174b56c464207f2b49eb232681a9ba33`; advanced to #550
  merge `d5b0c416a3c47502092382d52e398ade216c139b` before committing.
- Preserve layout, keyboard/focus, projection protocol, authorization and zero retries.
- Read governance, testing, Slide contract, initial-release accessibility contract,
  plan #474 and installed Next.js accessibility documentation.

## Plan

1. [x] Classify original #528 axe artifacts: two blank controls and list links.
2. [x] Include the visible blank label in each accessible name; let list links
       derive their names from visible type/title with an explicit separator.
3. [x] Upgrade existing axe dev tools to 4.14.0 (from #528) so regression gates
       exercise the detecting version; preserve all rules/severities.
4. [x] Verify normal/disabled controls, text/image links, keyboard/focus and
       narrow/wide list behavior through component and all 35 E2E tests.
5. [ ] Run canonical checks, integration, security and exact-head protected CI;
       merge after #548, then refresh #528 and verify protected auto-merge.

## Decisions / evidence

- Original CI run 40259134693 reports serious label-content-name-mismatch in
  four scenarios. Visible `空白⇔表示` differs from explicit `空白と表示を切り替え`.
- The list unnecessarily overrides its visible contents with aria-labelledby;
  use native content naming while keeping decorative number/arrow hidden and
  the visible type/title in the same existing accessible name.
- axe-core and @axe-core/playwright 4.14.0 are existing development tools already
  requested by #528. Moving these two upgrades into the regression repair
  ensures the main gate detects the original problem before other updates merge.
- No schema, migration, production dependency or deployment changes.

## Progress / verification

- Implemented native list naming and the visible-label-preserving blank names.
- Focused component tests: 4 files / 41 tests passed, including disabled and
  normal controls, text/image links and projection acknowledgements.
- `mise run check` passed before advancing base to #550: 569 unit and 129
  component tests, formatting, lint, types, all configuration guards and build.
- `pnpm security:check` passed: no high/critical findings; 356 approved production
  license records. Frozen installation passed.
- `pnpm test:integration`: 27 files / 145 tests passed.
- `pnpm test:e2e`: all 35 Chromium scenarios passed with axe 4.14, zero retries,
  including all four originally failing accessibility scenarios and narrow/wide
  list keyboard/focus assertions.
- Final `mise run check` on #550 base passed: 587 unit and 129 component tests,
  formatting, lint, typecheck, configuration guards and production build.
- `git diff --check` passed. Final scope/secret review found no unrelated code.

## Handoff

- Completed: intake, implementation and all local validation.
- Remaining: exact-head CI, merge and refresh dependent update.
- Blocker: none. #548 merges first; #528 final evidence belongs to parent #547.
