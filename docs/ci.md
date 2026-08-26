# Continuous integration

The `CI` workflow runs for every pull request and push to `main`. It has four
stable required-check names:

- `Quality`: frozen install plus the repository-owned `pnpm check` and coverage
  gate.
- `Database`: the committed migration history, live schema drift, deterministic
  seed, and PostgreSQL integration tests.
- `E2E`: the Chromium walking skeleton, accessibility scan, and browser runtime
  error guard.
- `Security`: production dependency audit, license inventory, Git-history secret
  scan, and pull-request dependency review.

The workflow only composes canonical package scripts; test behavior does not
live in GitHub Actions. Dependency caches are keyed by the pnpm lockfile. A newer
run for the same pull request or branch cancels its predecessor. Every job has a
timeout and uploads its available reports for 14 days even when a prior step
fails.

## Main branch protection

Configure `main` with the following repository rule:

1. Require a pull request before merging, with zero required human approvals.
2. Require `Quality`, `Database`, `E2E`, and `Security`, including branches being
   up to date before merge.
3. Block force pushes and branch deletion.
4. Do not permit bypass for coding-agent credentials.

Confirm the exact check names from a successful workflow run before changing the
rule. If a job name changes, update the rule in the same administrative change
so the repository is never left with a silently missing gate.

Production deployment is intentionally absent from `ci.yml`. The dedicated
deployment workflow uses minimal deployment-specific permissions, automated
exact-candidate validation, and the Sunday production approval defined by
governance.

## CI cost boundary

GitHub Actions is only a deterministic verification and merge gate. Workflows do
not invoke Codex or another model provider and do not consume model API keys.
Implementation, pause/resume, and review run through the local
subscription-authenticated Codex client described in
[`docs/agent-protocol.md`](agent-protocol.md).

PRs produced by local agents must still pass all protected checks. A local agent
review or successful local quality gate is useful evidence but is not a
substitute for protected CI.
