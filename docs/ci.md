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

The workflow only composes canonical package scripts; test behavior does not live
in GitHub Actions. Dependency caches are keyed by the pnpm lockfile. A newer run
for the same pull request or branch cancels its predecessor. Every job has a
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
rule. If a job name changes, update the rule in the same administrative change so
the repository is never left with a silently missing gate.

Production deployment is intentionally absent from `ci.yml`. A future deployment
workflow must use a protected GitHub Environment, minimal deployment-specific
permissions, and the explicit production approval defined by governance.

## Agent orchestration workflow

`.github/workflows/agent-orchestration.yml` is a manually dispatched, staged
workflow for a trusted Issue. It is intentionally not triggered by Issue or PR
text. It separates task preparation, Codex writing, Claude fallback, the common
quality gate, opposite-provider review, and PR publication into distinct jobs.

The repository owner must explicitly configure revocable sandbox
`CODEX_API_KEY` and `ANTHROPIC_API_KEY` secrets before provider-backed use. Each
provider job receives only its own secret and read-only GitHub permission. The
PR publication job receives no provider secret. PRs created by the workflow
still run the protected `Quality`, `Database`, `E2E`, and `Security` checks;
their pre-publication gate is not a substitute for protected CI.

The manual `simulate_codex_usage_limit` input skips the Codex call and creates a
synthetic normalized usage-limit result. Use it only to rehearse the full Claude
handoff path; ordinary runs leave it disabled.

See `docs/agent-protocol.md` for retry/fallback rules, checkpoint format,
single-writer ownership, review findings, staged rollout, and measured metrics.
