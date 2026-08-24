# ADR 0009: Separate administrator identities from Church users

- Status: accepted
- Date: 2026-08-24
- Related: #255, #256, #258, #259

## Context

Levi originally represented the Basic-authenticated platform operator as a
credential-free `users` row with a `platform_operators` subtype. That couples
administration to the Better Auth identity model used by churches and cannot
represent invited administrators cleanly.

## Decision

Levi stores administrative identities in `admin_users`, independently of
`users`, `accounts`, `sessions`, and `church_memberships`.

The current Basic credential remains in environment configuration. A
deterministic `BOOTSTRAP` admin user is the audit and authorization subject for
that credential; it has no database password. Invited administrators have a
case-insensitive login ID, a one-way password hash, invitation metadata, and a
status. Invitation does not grant access until the individual administrator
login described by #259 is implemented.

Administrative server actions authenticate again and pass an admin user ID to
the use case. Church session creation only admits an ACTIVE `users` row with an
ACTIVE church membership.

## Consequences

- Administrator records cannot sign in through Better Auth as church users.
- The shared Basic credential remains a transitional operational dependency.
- Plaintext temporary passwords may be returned once to the inviting operator,
  but are never persisted or logged.
- `platform_operators` is removed and the User actor-assignment constraint now
  describes Church users only.
- #259 must define activation, sessions, revocation, MFA, and Basic removal
  before invited administrators can authenticate.

This ADR supersedes ADR 0008 only for the internal actor storage model. Its
decision to retain Basic authentication remains active until #259.
