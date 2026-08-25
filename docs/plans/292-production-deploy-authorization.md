# WebARENA SSH allowlist-compatible production authorization

## Issue

- Issue: #292
- Branch: `codex/issue-292`
- Base commit: `245fab85562405ad7105609ea5fb2cdc800e50a8`

## Outcome

GitHub records exact release validation and protected Environment approval while
the production host remains reachable on TCP 22 only from the operator's
current `/32`. The operator executes the approved release through the existing
command-scoped host entrypoint without copying or reconstructing authorization
values manually.

## Context

- `.github/workflows/deploy-production.yml` previously connected from a
  GitHub-hosted runner whose dynamic source address cannot be safely allowlisted.
- `scripts/production-deploy-entrypoint.sh` already constrains passwordless sudo
  to four validated release values and a fixed root-owned deployment script.
- `docs/operations/manual-production-deploy.md` defines exact artifacts,
  immediate Issue approval, Environment approval, and the Sunday freeze.
- Attempt 2 of Actions run 32827887325 proved that direct runner SSH works only
  when TCP 22 is exposed to `0.0.0.0/0`; that exposure has been removed.

## Constraints

- Do not expose SSH globally or store a production SSH key in GitHub.
- Preserve exact CI checks, Issue approval, protected Environment approval,
  immutable image digests, and host-side validation.
- Do not add generic NOPASSWD shell, Git, Docker, or environment permissions.
- Production execution and firewall/access changes remain human-approved.

## Non-goals

- Deploying a new production release as part of this repository change.
- Adding a persistent self-hosted runner or an external tunnel service.
- Changing application, database, or user-facing behavior.

## Plan

1. [x] Replace GitHub-hosted runner SSH with a short-lived immutable
       authorization artifact behind the existing `production` Environment.
2. [x] Add an operator command that authenticates to GitHub, verifies the
       successful canonical run, validates the artifact, and invokes only the fixed
       host entrypoint through the local SSH alias.
3. [x] Add fail-closed configuration and synthetic execution checks.
4. [x] Update the deployment ADR and runbooks for IP-change recovery and removal
       of legacy GitHub SSH secrets.
5. [ ] Run all canonical checks, open a PR, wait for required CI, merge, and
       record the merged evidence on #292.

## Progress

- 2026-08-25 18:05 JST — Started; inspected #292/#279, ADR 0005, deployment
  workflow, host entrypoint, governance, and CI contract.
- 2026-08-25 18:18 JST — Replaced runner SSH with a one-day authorization
  artifact and added the allowlisted operator execution command.
- 2026-08-25 18:22 JST — Added synthetic success/denial checks; evidence:
  `mise exec -- pnpm deployment:config:check` passed.
- 2026-08-25 18:27 JST — Canonical repository check passed with the production
  HTTPS origin supplied to the build command; 317 unit/component tests passed
  and the production build completed.

## Decisions

- 2026-08-25 — Decision: use a two-stage GitHub authorization and operator
  execution flow.
  - Reason: it preserves GitHub audit gates without requiring a stable
    GitHub-hosted runner IP or exposing SSH globally.
  - Alternatives: rejected a persistent self-hosted runner because it expands
    workflow persistence and host compromise scope; rejected an outbound tunnel
    because it adds credentials, service dependency, and cost; rejected broad
    GitHub IP ranges because they are not least privilege for host SSH.
  - ADR: `docs/architecture/0005-deployment-selection-gate.md`.

## Risks and mitigations

- Risk: an operator could execute the wrong or failed run.
  - Mitigation: query the authenticated GitHub API, require a successful manual
    run from `main` and the canonical workflow path, then validate run/attempt
    identity inside the downloaded artifact.
- Risk: an old authorization could be replayed.
  - Mitigation: artifact retention is one day, the host independently rechecks
    exact values/main ancestry/Sunday freeze, and every deploy is recorded.
- Risk: an operator IP change removes SSH access.
  - Mitigation: retain WebARENA console recovery, update only the current `/32`,
    and verify a second SSH session before closing the first.

## Verification

- [x] `bash -n scripts/run-authorized-production-deploy.sh` — passed
- [x] `mise exec -- pnpm deployment:config:check` — passed, including synthetic
      successful authorization and rejected failed run
- [x] `mise exec -- pnpm format:check` — passed
- [x] `BETTER_AUTH_BASE_URL=https://levi-system.com BETTER_AUTH_TRUSTED_ORIGINS=https://levi-system.com mise exec -- pnpm check`
      — passed
- [ ] Required `Quality`, `Database`, `E2E`, and `Security` checks
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: repository implementation, focused checks, and runbook changes.
- Remaining: canonical checks, PR/CI/merge, removal of legacy Environment SSH
  secrets after a separately approved non-production authorization rehearsal.
- Blocker: none.
- Resume with: `mise exec -- pnpm check`.

## Result

Pending merge and required CI evidence.
