# Authentication and authorization policy

Authentication proves an actor's identity and session. Authorization decides
whether that actor may perform a specific action on a specific resource. Levi
must not treat “signed in” as permission to perform every action.

ADR 0006 selects Better Auth with revocable PostgreSQL sessions. Better Auth
proves identity and manages credentials, verification records, and sessions;
Levi remains responsible for every authorization decision.

When implemented:

- centralize authentication/session verification at the server boundary;
- distinguish platform operators from church users and deny by default;
- derive church context from the verified identity and membership, never from a
  client-supplied church ID;
- enforce authorization in server use cases before database mutation or content
  disclosure, never only by hiding UI;
- scope every record lookup to the authorized actor/context to prevent IDOR;
- protect mutations against CSRF/replay and test session expiry/revocation;
- keep audience/display access narrower than controller/operator access;
- keep public sign-up disabled and account creation behind the platform-operator
  use case;
- hash passwords with Better Auth's `scrypt`, revoke all sessions after
  administrator reset/suspension, force a user-selected password after a
  temporary password, and never log their secret values;
- use exact trusted origins, host-only secure cookies, database-backed rate
  limits, and no initial session cookie cache; and
- record security-relevant actions without recording credentials, tokens, or
  temporary passwords.

Every protected capability needs separate automated cases for unauthenticated,
authenticated-but-denied, allowed, expired/revoked, and cross-resource access.
The test fixture must name the actor type and church it grants. A generic
“admin” flag or a valid Better Auth session is not a substitute for testing the
actual platform or tenant authorization rule.

## Initial lifecycle

- The platform operator provisions and resets a church user; there is no public
  sign-up or email-based password recovery.
- A church user belongs to exactly one church and an initial church has exactly
  one church user.
- A database session expires 30 days after its last eligible refresh and may roll
  at most once per day.
- Logout revokes the current session. Administrator reset, suspension, and
  explicit revoke-all revoke every applicable session.
- Administrator reset produces a generated temporary password visible once and
  sets a persistent `must change password` state. A temporary-password session
  can perform only password change and logout.
- Expired session rows are removed on a bounded schedule; they are not retained
  as an authentication history.

Password, temporary password, cookie, session token, and auth secret values are
Restricted. Email addresses and retained IP/user-agent metadata are
Confidential. See [`data-classification.md`](data-classification.md).
