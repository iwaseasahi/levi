# Authentication and authorization policy

Authentication proves an actor's identity and session. Authorization decides
whether that actor may perform a specific action on a specific resource. Levi
must not treat “signed in” as permission to perform every action.

Until ADR 0004 is accepted, product routes requiring identity remain blocked.
When implemented:

- centralize authentication/session verification at the server boundary;
- model explicit roles/capabilities and deny by default;
- enforce authorization in server use cases before database mutation or content
  disclosure, never only by hiding UI;
- scope every record lookup to the authorized actor/context to prevent IDOR;
- protect mutations against CSRF/replay and test session expiry/revocation;
- keep audience/display access narrower than controller/operator access;
- record security-relevant actions in a future append-oriented audit store.

Every protected capability needs separate automated cases for unauthenticated,
authenticated-but-denied, allowed, expired/revoked, and cross-resource access.
The test fixture must name the capability it grants; “admin” is not a substitute
for testing the actual authorization rule.
