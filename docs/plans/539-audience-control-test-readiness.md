# Wait for projection readiness in the control component test

## Issue

- Issue: #539 (deployment of #536 / PR #538)
- Branch: `codex/issue-539`
- Base: `0f86daa82236d7fad6cdb2c282580d2f8775ecc0`

## Outcome and constraints

Remove the component test's race between DOM rendering and the projection
protocol readiness effect. Preserve all production behavior and source/origin,
authorization and readiness guards. No retries, timeout changes or quarantine.

## Plan

1. [x] Inspect failing main Quality job 120224228858 and projection hooks.
2. [x] Control the initial fetch and prove early commands are ignored, then wait
       for the ready ACK before asserting accepted controls.
3. [x] Run focused/component/canonical checks and review; PR tracks exact-head CI.
4. [ ] Merge, verify main CI and resume the approved standard production deploy.

## Evidence and decisions

- main CI 39895298857 failed at `--audience-scale: 1.1` vs `1`. The test
  waited for content DOM, while `useProjectionAudience` updates its ready
  snapshot in a passive effect. The rejected early CONTROL is expected.
- Use persisted protocol notifications as observable readiness, and a deferred
  initial fetch to test both readiness states deterministically.
- Production deploy preparation exited 65 before publishing images. Existing
  production readiness remains healthy; no production mutation occurred.

## Verification

- `pnpm exec vitest run --config vitest.component.config.ts
src/app/church/audience/direct-audience-display.component.test.tsx`: 9/9 pass.
- `pnpm check`: PASS; format/lint/typecheck, 552 unit tests, 129 component tests,
  configuration checks and production build.
- `git diff --check`: PASS. Reviewed the complete diff: test and plan only.

Retain the existing untrusted source/origin rejection, blanking and
navigation assertions. Prove the new readiness assertion rejects early CONTROL
without weakening production guards. Run `pnpm check` and coverage, then require
Quality/Database/E2E/Security on the exact head before merge and deployment.

## Handoff or blockers

- Completed: root cause identified and release stopped safely.
- Remaining: test correction, verification/PR/merge and approved release.
- Blocker: none.
- Resume with: edit the controlled readiness test.
