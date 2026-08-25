# Make the production www redirect explicitly HTTP 308

## Issue

- Issue: #295
- Branch: `codex/issue-295`
- Base commit: `2744fc7`

## Outcome

`https://www.levi-system.com/*` redirects to the canonical apex origin with
HTTP 308 while preserving the path and query, matching the production domain
verifier and the approved cutover specification.

## Context

- `deploy/production/Caddyfile` used Caddy's `permanent` redirect token.
- Live verification showed that token returns HTTP 301.
- `scripts/check-production-domain.ts` and the cutover runbook require HTTP 308.
- DNS, TLS certificates, apex readiness, and noindex headers are already working.

## Constraints

- Keep `https://levi-system.com` as the canonical origin.
- Preserve path, query, and the noindex response header.
- Do not deploy until required CI passes and the exact production action receives
  immediate human approval.

## Non-goals

- Changing DNS, certificates, application routes, or authentication origins.
- Changing apex HTTP-to-HTTPS behavior managed by Caddy auto HTTPS.

## Plan

1. [x] Replace the ambiguous permanent redirect token with explicit status 308.
2. [x] Validate deterministic domain configuration and the pinned Caddy config.
3. [ ] Run canonical checks and merge only after required CI passes.
4. [ ] Re-run live production verification after an approved exact deployment.

## Progress

- 2026-08-25 19:12 JST — Started from `2744fc7`; live response confirmed HTTP
  301 while the approved specification requires HTTP 308.
- 2026-08-25 19:14 JST — Updated the Caddy redirect and deterministic assertion
  to require an explicit 308 response.
- 2026-08-25 19:15 JST — Deterministic domain and production Compose checks,
  pinned Caddy validation, and `mise run check` passed. The canonical check
  included formatting, lint, type checking, 264 unit tests, 53 component tests,
  all configuration invariants, and the production build.

## Decisions

- 2026-08-25 — Decision: use Caddy's explicit `308` status argument.
  - Reason: `permanent` resolves to 301 and conflicts with the accepted contract.
  - Alternatives: weaken the verifier to accept 301; rejected because it would
    change the approved behavior instead of correcting the implementation.

## Risks and mitigations

- Risk: a syntax error prevents the production proxy from starting.
  - Mitigation: validate with the pinned Caddy image before merging.
- Risk: path or query is lost during redirect.
  - Mitigation: retain `{uri}` and verify the live check path and query.

## Verification

- [x] `mise exec -- pnpm production:domain:check`
- [x] `mise exec -- pnpm production:config:check`
- [x] Pinned Caddy image configuration validation
- [x] `mise run check`
- [ ] Required CI on the exact commit
- [ ] Approved production deployment followed by `production:domain:verify`
- [ ] Final diff reviewed for scope, secrets, and unsafe defaults

## Handoff or blockers

- Completed: root cause identified, explicit 308 configuration implemented, and
  local verification passed.
- Remaining: PR and CI, approved deployment, and live verification.
- Blocker: none for repository work; production deployment remains a human gate.
- Resume with: review the diff, commit, push, and open the PR.

## Result

Pending.
