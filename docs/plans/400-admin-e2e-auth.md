# Isolate authenticated administration E2E requests

Issue #400, branch `codex/issue-400`, base `bc27deb`. Writer lease acquired.
Discovered during #387; its implementation remains in a separate worktree/PR.
Read governance, testing strategy and existing Basic/BetterAuth limits.

## Plan

1. [x] Inspect challenge-first browser setup and shared five-failure bucket.
2. [x] Scope synthetic preemptive Basic authorization to local admin routes;
       preserve deliberate unauthenticated scenarios and assert first request.
3. [ ] Run canonical checks/E2E, review, exact-head CI and merge.

## Evidence / constraints

- Earlier Slide E2E run: 26 passed / administration dashboard unexpected 429.
  Diagnostic run: 27 passed; no retries. Timing sensitivity remains a defect.
- No production auth/control changes, dependency, schema or production operation.
- Fixture callback excludes Mailpit and all other origins/paths. Credential-bearing
  administration screenshots/traces/videos remain off. Do not log header values.
- Full evidence and final head are recorded in the PR. No human decision needed.
