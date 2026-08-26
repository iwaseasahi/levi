# ADR 0010: Database sessions inside the Basic administration boundary

- Status: superseded by ADR 0012
- Date: 2026-08-26
- Related: #259

## Context

ADR 0008 retains HTTPS Basic authentication as the outer administration
boundary, while ADR 0009 separates administrator identities from Church users.
The shared Basic credential alone cannot attribute actions, provide a reliable
application logout, or force an invited administrator to replace a temporary
password.

## Decision

Levi keeps Basic authentication on every `/admin` request and adds an
independent `admin_users` login inside that boundary. Successful individual
login creates an opaque 256-bit token in a host-only, HttpOnly, SameSite=Lax
cookie scoped to `/admin`; production also requires Secure. PostgreSQL stores
only its SHA-256 hash in `admin_sessions`, with a fixed 30-day expiry.

`INVITED` administrators may access only initial password change and logout.
Password change activates the identity and revokes its other sessions.
`SUSPENDED`, deleted, and expired identities are rejected on every lookup.
Login failures are limited in PostgreSQL. Administrator passwords use the same
Better Auth `scrypt` implementation as Church credentials, but administrator
sessions do not use Better Auth tables.

Every protected page and Server Action verifies both Basic authentication and
the individual session. Basic remains the break-glass outer credential and is
not replaced by this decision.

## Consequences

- Administration actions are attributable to an individual `admin_users` ID.
- Closing the application session is reliable even if Chrome caches Basic
  credentials.
- Database compromise exposes session hashes, not reusable raw tokens.
- Basic and individual login rate limits are separate; both fail closed when
  PostgreSQL is unavailable.
- MFA and self-service administrator password recovery remain out of scope.

## Verification

Unit tests cover token generation, hashing, and exact cookie parsing.
Integration tests cover login, expiry, suspension, logout, first password
change, revocation, and rate limiting. E2E tests prove Basic-only access is
redirected to individual login and an invited administrator cannot reach
management pages before changing the temporary password.

ADR 0012 replaces this custom session/token implementation with a dedicated
Better Auth realm and replaces temporary-password activation with email setup.
