# Prepare the production domain before purchase

## Issue

- Issue: #88
- Branch: `codex/issue-88`
- Base commit: `f6b7c72`

## Outcome

Levi's production configuration is fixed to `https://levi-system.com`, the
canonical and `www` behavior is testable, and the operator can complete DNS and
TLS cutover after purchasing the domain without changing application code.

## Context

- `deploy/production/Caddyfile` currently serves only `LEVI_DOMAIN`.
- Production examples still use `levi.example.invalid` although Issue #88 has
  selected `levi-system.com`.
- `.github/workflows/production-smoke.yml` accepts any HTTPS origin.
- Domain purchase, DNS changes, certificate issuance, and production exposure
  remain human approval boundaries.

## Constraints

- Do not purchase the domain, change DNS, issue a certificate, deploy, or store
  a production IP address or credential in the repository.
- Keep the canonical origin free of `www` and a trailing slash.
- Initially publish only an apex A record and a `www` CNAME; do not publish an
  AAAA, wildcard, or mail record.

## Non-goals

- Provisioning WebARENA Indigo.
- Configuring GitHub production secrets or `PRODUCTION_BASE_URL` before the
  public endpoint exists.
- Sending mail from `levi-system.com`.

## Plan

1. [x] Record the selected domain as repository configuration and reject origin
       drift in deterministic checks.
2. [x] Add and validate canonical HTTPS and `www` redirect behavior in Caddy.
3. [x] Add an opt-in live verification command for DNS, redirects, readiness,
       and TLS after purchase.
4. [x] Document the XServer Domain cutover, rollback, and approval boundary.
5. [ ] Run the canonical checks, open a pull request, and wait for required CI.

## Progress

- 2026-08-24 15:30 JST — Started from `f6b7c72`; inspected Issue #88,
  production Compose, Caddy, environment examples, smoke workflow, and deploy
  runbook.
- 2026-08-24 15:50 JST — Completed repository configuration, Caddy redirect,
  opt-in live verification, and cutover runbook. Evidence:
  `mise exec -- pnpm production:domain:check`,
  `mise exec -- pnpm production:config:check`,
  `mise exec -- pnpm deployment:config:check`, `mise exec -- pnpm lint`, and
  `mise exec -- pnpm typecheck` passed; the pinned Caddy 2.10.2 image validated
  and formatted the Caddyfile without a diff.
- 2026-08-24 17:07 JST — `mise run check` passed: formatting, lint,
  TypeScript, 261 unit tests, 52 component tests, local/production/backup/deploy
  configuration checks, and the Next.js production build.

## Decisions

- 2026-08-24 — Decision: keep `deploy/production/domain.json` as the non-secret
  source of truth for the selected public domain.
  - Reason: examples, Caddy, and monitoring still need environment variables,
    so a deterministic check is required to prevent duplicated values from
    drifting.
  - Alternatives: hard-code only the Caddyfile; leave generic example domains.
- 2026-08-24 — Decision: make live checks explicit and opt-in.
  - Reason: the domain is not acquired yet, so the normal repository check must
    remain network-independent and must not create external traffic failures.

## Risks and mitigations

- Risk: a wrong DNS record exposes the wrong host.
  - Mitigation: live verification requires the expected IPv4 out of band and
    rejects unexpected A or any AAAA record.
- Risk: `www` and application origins diverge.
  - Mitigation: configuration checks enforce apex-only Better Auth origins and
    a path/query-preserving permanent redirect.
- Risk: verification is run before DNS is ready.
  - Mitigation: live verification is not part of `pnpm check` and the runbook
    separates pre-purchase checks from post-DNS checks.

## Verification

- [x] `mise exec -- pnpm production:domain:check`
- [x] `mise exec -- pnpm production:config:check`
- [x] Caddy configuration validation with the pinned production image
- [x] `mise run check`
- [ ] Final diff reviewed for secrets, real IP addresses, and external actions

## Handoff or blockers

- Completed: configuration, Caddy redirect, live verifier, runbook, and narrow
  verification.
- Remaining: final review, PR, and required CI.
- Blocker: none for repository work; purchase and live cutover intentionally
  remain human gates.
- Resume with: review the complete diff, commit, push, and open the PR.

## Result

Pending.
