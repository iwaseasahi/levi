# Distinct password setup and recovery emails

## Issue

- Issue: #376
- Branch: `codex/issue-376`
- Base commit: `24f777936bbcd99ea6a3017b9a93a341e6e3d257`

## Outcome

Separate initial setup from password recovery emails for both auth domains;
new links remain usable for three days.

## Context

The shared SMTP mailer combines both purposes. Both Better Auth options set
24-hour token lifetimes. Invitation forms repeat this duration.

## Constraints and non-goals

Follow governance/autonomy.md and testing.md; no production data or external
email in tests. No schema migration, production deploy, resend, or Issue #59 work.
Existing issued token expiry must not change.

## Plan

1. [x] Inspect invitations, mail callbacks and expiry settings.
2. [x] Implement distinct copy and server-state selection; set expiry to 72 hours.
3. [x] Verify regression coverage and documentation.
4. [ ] Review, create PR and merge only after all required checks pass.

## Progress and decisions

- 2026-08-31 — Created isolated worktree and Issue; no production changes.
- 2026-08-31 — Added four mail variants and persisted lifecycle selection.
- 2026-08-31 — Corrected synthetic integration fixtures to satisfy membership
  and verification expiry constraints; aged stored tokens without changing the
  process clock. Started the existing development PostgreSQL service for the
  guarded, disposable Bible rehearsal databases; normal application data was
  not reset. No test-database guard or SMTP isolation was weakened.
- ADR: [0014](../architecture/0014-password-link-purpose-and-validity.md).

## Risks and mitigations

Longer bearer-token lifetime is requested by the owner. Preserve single use,
session revocation and generic responses; test both identity domains.

## Verification

- `mise run check`: passed formatting, lint, typecheck, 314 unit tests,
  65 component tests, configuration safety checks, and production build.
- `mise exec -- pnpm test:integration`: passed 19 files / 91 tests, including
  real Better Auth token creation, 48-hour success, 73-hour rejection and reuse
  rejection in both identity domains. Mail delivery was discarded.
- `mise exec -- pnpm test:e2e`: passed 20 Chromium tests, including all four
  email subjects and bodies through isolated disposable Mailpit, not the
  development inbox or external SMTP.
- `mise exec -- pnpm security:check`: passed; no vulnerabilities and 315 approved
  production license records.
- `git diff --check`: passed. Self-review found no schema, dependency, session
  duration, transport, production data or unrelated changes.

## Handoff or blockers

Implementation and local verification complete; no blocker. Next: PR and exact
head required CI (Quality, Database, E2E, Security), then merge.

## Result

Setup and recovery mail are separate for both identity domains. Newly issued
links last three days; previously issued token rows are unchanged. Production
deployment is out of scope and has not been performed.
