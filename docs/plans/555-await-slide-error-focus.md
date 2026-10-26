# Observe error focus after asynchronous rendering

## Issue / outcome

- Issue #555; parent #547, discovered in #551 canonical checks.
- Branch `codex/issue-555`, base `5d5dd26770954a38abcbfe1f254a3c0eb42e73ec`;
  advanced to #512 merge `6c53fd397050f2b6e4f0b3843cee5a8587159ea3`.
- Preserve production focus behavior, exact assertions and zero test retries.

## Evidence / root cause

The Slide editor test observed the alert inserted in the DOM while activeElement
was still body. SlideError focuses in a passive effect, so insertion and focus
are separate observable events. The Slide list test uses the same premature
assertion. Await the focus outcome with existing waitFor rather than assuming
findByRole waits for an effect. No sleeps, relaxed assertions or retry changes.

## Plan / verification

1. [x] Read testing and governance policy; isolate the Issue and lease.
2. [x] Update both focus assertions to await actual focus.
3. [x] Temporarily disable production focus and prove both assertions still fail;
       restore the source and run the two focused suites.
4. [ ] Run canonical checks and exact-head protected CI, then merge.
5. [ ] Refresh the existing update PRs, retaining all protected checks.

## Progress / handoff

- A temporary disabled focus call caused both updated assertions to fail as
  expected. The production file was restored and has no diff.
- Both focused suites passed: 2 files / 21 tests.
- `mise run check` passed: 587 unit tests, 129 component tests, formatter, lint,
  typecheck, configuration guards and production build.
- After #512 merged, advanced to that base and reran local/deployment guards;
  both passed. `git diff --check` passed and final diff contains only tests/plan.
- No production source, dependencies, schema, migrations or configuration changed.
- Remaining: exact-head protected CI, merge and resume #551–#553.
