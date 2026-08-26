# Issue #341: Better Auth administrator identity and email delivery

## Issue

- Issue: #341
- Branch: `codex/issue-341`

## Outcome

Move administrator credentials, sessions, invitation setup, and password reset
to a dedicated Better Auth realm while retaining Basic authentication as an
outer boundary. Deliver production messages through Gmail and capture local
messages with Mailpit.

## Decisions

- Administrator and church identities use separate Better Auth tables, secrets,
  cookie prefixes, and API base paths.
- Administrator sessions last 30 days; password reset revokes existing sessions.
- Invitation creates an `INVITED` identity and sends the same one-hour Better
  Auth password setup flow used by password reset.
- Production accepts only authenticated Gmail submission on port 587.
- Development uses unauthenticated Mailpit on loopback port 1125 with inbox UI
  port 8026. No development email is externally delivered.
- Gmail outage redundancy, queues, and retry orchestration are out of scope.
- Existing custom administrator sessions are revoked by migration. Credential
  hashes are preserved in `admin_accounts` so existing login continues.

## Implementation

- [x] Add dedicated Better Auth schema and migration.
- [x] Add `/api/admin-auth/*`, administrator login, logout, and session access.
- [x] Add invitation email, forgot-password, and reset-password screens.
- [x] Add Gmail SMTP and Mailpit development configuration.
- [x] Exercise actual Mailpit messages in E2E tests.
- [x] Complete all local gates.
- [ ] Complete required CI on the pull-request head.

## Verification

- [x] `mise exec -- pnpm check`
- [x] `mise exec -- pnpm security:check`
- [x] `mise exec -- pnpm db:check`
- [x] `mise exec -- pnpm test:integration` — 86 passed
- [x] `mise exec -- pnpm test:e2e` — 17 passed, including invitation mail captured by Mailpit
- [x] `git diff --check`

## Production rollout boundary

Gmail account setup, app-password creation, protected environment changes, and
production deployment remain separate explicitly approved operations. This
implementation may merge before Gmail is ready, but must not be deployed until
the protected values and real administrator email addresses are ready.
