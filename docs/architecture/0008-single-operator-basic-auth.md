# ADR 0008: Protect the single-operator administration UI with Basic authentication

- Status: accepted
- Date: 2026-08-22
- Decision owners: product owner and security owner
- Supersedes: ADR 0006 only for platform-operator authentication
- Superseded by: none

## Context

The initial release has one Levi platform operator. That operator needs the
protected administration UI only to create church accounts and reset their
passwords. Giving this actor a public Better Auth credential and session adds a
second application login lifecycle that is unnecessary while there is exactly
one operator.

Church users still require Better Auth email/password login and revocable
30-day database sessions as decided in ADR 0006.

## Decision

- Protect every `/admin` route with HTTP Basic authentication in the Next.js
  Proxy.
- Configure one username and one Better Auth `scrypt` verifier through
  `ADMIN_BASIC_AUTH_USERNAME` and `ADMIN_BASIC_AUTH_PASSWORD_HASH`. Never store
  or configure the plaintext password.
- Require HTTPS in production. The application container remains private behind
  the repository's Caddy TLS edge.
- Map successful Basic authentication to one deterministic, credential-free
  internal `platform_operators` actor. The actor has no Better Auth `accounts`
  row and cannot sign in through the church login endpoint.
- Independently authenticate every administration Server Action. Proxy checks
  improve the browser boundary but are not the authorization decision for a
  mutation.
- Fail closed when configuration, database access, or the internal actor is
  unavailable. Apply a PostgreSQL-backed global limit of five failed attempts
  per 60 seconds.
- Generate the verifier only through the interactive
  `pnpm admin:hash-password` command. The command accepts no password argument
  and suppresses terminal echo.

## Consequences

Basic authentication is inexpensive and sufficient for the approved single
operator, but browsers cache credentials and Levi cannot provide a dependable
logout button. Credential rotation may require closing all browser windows.
The single shared credential also cannot attribute actions among multiple
people. Its verifier is Restricted data and production configuration remains a
manual secret-management operation.

## Reconsider when

Replace Basic authentication with individually attributable operator accounts,
revocable sessions, and MFA before a second operator is authorized, or when
audit, logout, delegated access, or per-operator revocation becomes required.

## Verification

Unit tests cover strict Basic parsing, verifier checks, rate limiting, fail-closed
behavior, and Proxy responses. Database verification proves the deterministic
internal operator is active and has no credential account. E2E tests prove that
church sessions cannot enter administration and that Basic-authenticated
provisioning and reset still work.

## Later evolution

ADR 0009 supersedes this ADR's internal `users` / `platform_operators` actor
mapping with an independent `admin_users` model. Basic authentication itself
remains the current administration entry point until #259 is implemented.
