# Church login, logout, and revocable session lifecycle

## Issue

- Issue: #44
- Branch: `codex/issue-44`
- Base commit: `2333a51`

## Outcome

An active Church user can sign in with email and password, refresh and open a
second same-origin window with the same database-backed session, and sign out.
Every protected Church capability derives its tenant from the current session
and immediately rejects missing, expired, revoked, pending, or suspended actors.

## Constraints

- Better Auth remains the only password, session-cookie, CSRF, rotation, and
  rate-limit implementation.
- Public sign-up, remember-me selection, cross-domain cookies, cookie caching,
  trusted proxy headers, and bearer/JWT authentication remain disabled.
- A valid Better Auth identity is insufficient for Church authorization. The
  protected data boundary must re-read User, membership, and Church state and
  derive `churchId` on every operation.
- Authentication failure is generic and no email, password, cookie, token,
  request body, or raw auth exception enters logs or test artifacts.
- A `mustChangePassword` user may reach only the Issue #45 password-change
  placeholder and logout; normal Church content remains denied.

## Plan

1. [x] Add and test session-creation eligibility and the server-derived Church
       tenant access boundary.
2. [x] Build accessible login, protected Church landing, forced-change gate,
       and logout interactions against the Better Auth route.
3. [x] Prove valid/invalid/suspended/rate-limited login and expired/revoked/
       logout session behavior against PostgreSQL.
4. [x] Prove login, refresh, second-window continuity, logout, expiry, and
       revocation in latest Chromium without retaining auth artifacts.
5. [x] Run canonical checks, review the exact diff, publish a PR, and merge only
       the exact commit that passes Quality, Database, E2E, and Security.

## Decisions

- 2026-08-21 — Use Better Auth's browser client for login and logout.
  - Reason: the mounted auth Route Handler owns Set-Cookie processing and origin
    validation directly, avoiding application parsing or replay of session
    cookie headers.
- 2026-08-21 — Enforce actor eligibility both before session creation and in a
  Church tenant DAL on every protected access.
  - Reason: the first boundary prevents new sessions for stopped identities;
    the second makes later suspension and revocation effective immediately.

## Verification

- [x] 50 unit tests
- [x] 8 component tests
- [x] 25 PostgreSQL integration tests
- [x] 7 latest-Chromium E2E tests
- [x] `pnpm db:check` (unchanged schema)
- [x] `pnpm check`
- [x] `pnpm security:check`
- [x] `git diff --check`

## Progress

- 2026-08-21 15:09 JST — Started after Issue #43 / PR #66 merged; re-read ADR
  0006, the initial-release authentication contract, and the authorization
  policy. No blocker.
- 2026-08-21 15:29 JST — Completed login/logout UI, session eligibility,
  tenant-derived protected access, forced-change gating, database rate-limit
  proof, and refresh/second-window/expiry/revocation browser coverage.

## Result

Active Church users can authenticate through Better Auth and reach only their
server-derived tenant. Suspended actors cannot create sessions; missing,
expired, revoked, and logged-out sessions cannot use protected pages. The
temporary-password gate remains restricted to the Issue #45 route.
