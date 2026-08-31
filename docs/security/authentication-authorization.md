# Authentication and authorization policy

Authentication proves an actor's identity and session. Authorization decides
whether that actor may perform a specific action on a specific resource. Levi
must not treat “signed in” as permission to perform every action.

ADR 0006 selects Better Auth with revocable PostgreSQL sessions for church
users. ADR 0008 protects the administration entry with HTTPS Basic
authentication, ADR 0009 stores its identities in `admin_users`, and ADR 0012
uses a dedicated Better Auth realm inside the Basic boundary. Levi
remains responsible for every authorization decision.

The implemented boundary follows these rules:

- centralize authentication/session verification at the server boundary;
- keep administrator identities separate from church users and deny by default;
- derive church context from the verified identity and membership, never from a
  client-supplied church ID;
- represent that context as a branded `ChurchScope`; church-owned use-case and
  repository interfaces do not accept a raw UUID in its place;
- enforce authorization in server use cases before database mutation or content
  disclosure, never only by hiding UI;
- scope every record lookup to the authorized actor/context to prevent IDOR;
- protect mutations against CSRF/replay and test session expiry/revocation;
- keep audience/display access narrower than controller/operator access;
- keep public sign-up disabled and account creation behind the platform-operator
  use case;
- hash passwords with Better Auth's `scrypt`, revoke all sessions after a
  successful self-service reset or suspension, require 72-hour single-use email
  links for invitations and recovery, and never log secret values;
- use exact trusted origins, host-only secure cookies, database-backed rate
  limits, and no initial session cookie cache; and
- record security-relevant actions without recording credentials or tokens.

The `/admin` route is challenged by Proxy. The login page then requires an
individual `admin_users` credential, and every protected page and administration
Server Action independently repeats Basic and individual-session verification.
A valid Basic credential maps only to the deterministic bootstrap admin user,
which has no individual Better Auth account or session. The configured password is a
Better Auth `scrypt` verifier, never plaintext. Five failures per 60 seconds are
limited globally in PostgreSQL, and missing configuration or storage fails
closed. Individual Better Auth login is independently database-rate-limited.
Its host-only, HttpOnly, SameSite=Lax cookie maps to a dedicated
`admin_sessions` row with rolling 30-day expiry. Basic authentication is permitted only behind the production
HTTPS edge. See [`../operations/admin-basic-auth.md`](../operations/admin-basic-auth.md).

Every protected capability needs separate automated cases for unauthenticated,
authenticated-but-denied, allowed, expired/revoked, and cross-resource access.
The test fixture must name the actor type and church it grants. A generic
“admin” flag or a valid Better Auth session is not a substitute for testing the
actual platform or tenant authorization rule.

`ChurchScope` is a compile-time misuse guard, not the sole authorization
mechanism. Runtime queries still include the scope's `church_id`, PostgreSQL
enforces composite ownership, and foreign and nonexistent UUIDs return the same
public status and body. An explicit TypeScript cast must never be used in
application code to manufacture a scope; test-only casts name synthetic tenant
fixtures.

## Initial lifecycle

- The platform operator provisions a church's initial user and may invite
  additional users to an existing active church; there is no public sign-up.
- A church user belongs to exactly one church. A church may have multiple users,
  each with an independent credential and session but the same derived
  `ChurchScope`.
- A database session expires 30 days after its last eligible refresh and may roll
  at most once per day.
- Logout revokes the current session. Successful self-service password reset,
  suspension, and explicit revoke-all revoke every applicable session.
- Administrator and church-user invitation and self-service reset use 72-hour
  email links.
  Successful setup/reset activates an invited identity and revokes existing
  administrator sessions.
- Expired session rows are removed on a bounded schedule; they are not retained
  as an authentication history.

Password, Basic password verifier, invitation/reset token, cookie, session
token, and auth secret values are Restricted. Email addresses and retained
IP/user-agent metadata are Confidential. See
[`data-classification.md`](data-classification.md).
