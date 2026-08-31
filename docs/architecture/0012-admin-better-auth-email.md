# ADR 0012: Dedicated Better Auth realm for administrators

## Status

Accepted

The password-link expiry clause is superseded by [ADR 0014](0014-password-link-purpose-and-validity.md).

## Context

Levi originally implemented individual administrator login with custom password
and session code behind Basic authentication. Administrator invitation and
recovery need email delivery and the same proven lifecycle semantics used for
church identities, without allowing either identity population to authenticate
as the other.

## Decision

Use a second Better Auth instance at `/api/admin-auth` with dedicated
administrator user, account, session, verification, and rate-limit tables. Give
it a distinct secret and cookie prefix. Retain Basic authentication as the outer
boundary for all administrator pages and API routes.

Use the administrator's case-insensitively unique email address as the sole
login identifier. Do not maintain a separate username or login ID.

Use Better Auth password-reset tokens for both invitation password setup and
active administrator recovery. Deliver them through Gmail in production and
Mailpit in development. Tokens expire after 24 hours and successful reset
revokes existing sessions.

## Consequences

- Better Auth owns administrator password hashes and session lifecycle.
- Administrator login, invitation, and recovery use one email identity.
- Church and administrator credentials cannot collide or cross-authenticate.
- Local testing exercises real SMTP/message parsing without sending mail.
- Production requires a Gmail app password and distinct administrator auth
  secret before deployment.
- Existing administrator sessions are intentionally invalidated during
  migration; existing password hashes remain usable.
