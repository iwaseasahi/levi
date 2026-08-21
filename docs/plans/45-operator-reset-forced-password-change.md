# Operator reset and forced password change

## Issue

- Issue: #45
- Branch: `codex/issue-45`
- Base commit: `0fffee5`

## Outcome

An authenticated platform operator can replace one active Church user's
credential with a generated temporary password, revoke every session, and hand
the value off once. The user can authenticate with it only to choose a new
password; successful change atomically verifies the temporary credential,
clears the forced-change gate, and revokes every other session.

## Plan

1. [x] Implement transaction-level operator reset and forced-change use cases
       with Better Auth scrypt primitives and generic failures.
2. [x] Add protected Server Actions, confirmation/loading/focus/error/success
       UI, and one-time secret handling without email or network delivery.
3. [x] Prove authorization, replay, stale session, credential replacement, and
       all-session/other-session revocation against PostgreSQL.
4. [x] Prove the complete operator reset → temporary login → forced change →
       normal Church access flow in latest Chromium without auth artifacts.
5. [x] Run canonical checks and merge only the exact commit passing all four
       required GitHub jobs.

## Decisions

- Use `hashPassword` and `verifyPassword` from the pinned Better Auth release
  inside Levi-owned Serializable transactions. The public reset endpoints and
  email callbacks remain disabled.
- Keep the current forced-change session after a successful user-selected
  change and delete every other session. This gives an explicit success path
  while satisfying immediate revocation on all other devices.

## Verification

- [x] Unit/component/integration/E2E
- [x] `pnpm db:check`
- [x] `pnpm check`
- [x] `pnpm security:check`
- [x] `git diff --check`

## Progress

- 2026-08-21 15:36 JST — Started after Issue #44 / PR #67 merged; re-read ADR
  0006 and the account lifecycle runbook. No blocker.
- 2026-08-21 15:49 JST — Completed implementation and local verification: 51
  unit, 10 component, 32 PostgreSQL integration, and 8 latest-Chromium E2E
  tests pass. Database, canonical, security, formatting, and diff checks pass.

## Result

The protected operator UI now resets an active Church credential, revokes every
session, records only safe audit metadata, and reveals the generated temporary
password once. Temporary-password login is gated to password change and logout;
successful change verifies the current secret, stores a Better Auth scrypt hash,
clears the gate, and revokes every other session. Duplicate reissue invalidates
the earlier value, completed-change replay and stale sessions are rejected, and
no public or outbound-email recovery callback is configured.
