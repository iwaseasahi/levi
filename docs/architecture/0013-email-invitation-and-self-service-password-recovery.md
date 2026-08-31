# ADR 0013: Use email invitation and self-service password recovery

## Status

Accepted

The password-link expiry clause is superseded by [ADR 0014](0014-password-link-purpose-and-validity.md).

## Context

ADR 0006 originally selected an operator-managed temporary-password handoff for
church users because Levi did not yet operate outbound email. Levi now has Gmail
SMTP in production, Mailpit in development, Better Auth invitation and recovery
flows, and independently authenticated administrators. Church users can recover
their own passwords, so retaining an administration workflow that issues and
reveals passwords would duplicate credential lifecycle code and unnecessarily
expose credentials to the platform operator.

## Decision

Use Better Auth single-use verification tokens for church-user and administrator
invitation/password setup and self-service recovery.

- Invitation and recovery links expire after 24 hours.
- Forgot-password requests return a generic response regardless of identity
  existence or eligibility.
- Successful password reset revokes existing sessions for the identity.
- Signed-in users may change their own password through their account screen.
- Production sends email through the approved Gmail SMTP account; development
  captures it in Mailpit.
- The platform administration UI may invite identities but does not generate,
  display, reset, or communicate their passwords.
- Public sign-up remains disabled. Levi authorization and church membership are
  unchanged.
- Legacy forced-password-change code may remain only while legacy account state
  requires it; it is not an operator recovery mechanism for new accounts.

This decision supersedes the outbound-email, operator-reset, temporary-password
handoff, and email-reset rejection sections of ADR 0006. It extends ADR 0012's
administrator email lifecycle to church identities without merging the two
Better Auth realms.

## Consequences

- Operators no longer learn user passwords or handle them out of band.
- Mailbox security and SMTP delivery become availability dependencies for setup
  and recovery; Gmail disaster recovery is explicitly out of scope.
- Tokens, SMTP credentials, cookies, and password hashes remain Restricted and
  must never enter logs, Issues, artifacts, screenshots, or prompts.
- Integration and E2E coverage must prove generic reset responses, 24-hour
  expiry, single use, session revocation, invitation activation, and isolation
  between administrator and church-user realms.
