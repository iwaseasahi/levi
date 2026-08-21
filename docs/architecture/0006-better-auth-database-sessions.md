# ADR 0006: Use Better Auth with database sessions

- Status: accepted
- Date: 2026-08-21
- Decision owners: product owner and security owner
- Supersedes: ADR 0004
- Superseded by: none

## Context

The approved initial release requires email/password login, one church user per
church, a separate Levi platform operator, operator-provisioned accounts, and
platform-operator-managed password reset without outbound email. Levi uses
Next.js 16, Prisma 7, and PostgreSQL. The solution must avoid identity-provider
usage pricing, keep tenant authorization in Levi, and be maintainable by coding
agents without implementing security-critical password and session primitives
from scratch.

Next.js recommends using an authentication library and enforcing authorization
close to the data source. Auth.js supports credential forwarding, but its
Credentials provider deliberately leaves password storage, hashing, rate
limiting, and password reset to the application. Hosted identity services reduce
some operational work but add per-user pricing, external identity storage, and
vendor coupling that the current requirements do not need.

Better Auth is an MIT-licensed, self-hosted TypeScript authentication library.
Its documented Next.js 16 and Prisma integration supports email/password,
database sessions, server-side password changes, session revocation,
origin/CSRF validation, and rate limiting. Its security policy supports only the
latest release, so using it creates an explicit upgrade obligation.

## Decision

Use the current stable Better Auth release, pinned exactly in the lockfile, with
its Prisma adapter and the existing PostgreSQL database. Better Auth authenticates
identity and manages credentials, verification records, and sessions. Levi owns
platform-operator authorization, church membership, tenant scope, and all domain
data authorization.

### Identity and tenancy

- A Better Auth user is an identity, not a tenant and not an authorization
  decision.
- A platform operator and a church user are distinct application actor types.
  Platform-operator access is denied by default and cannot be inferred merely
  from a valid session.
- A church membership links a user to a church. The initial schema enforces one
  membership per user and one user per church. A later approved migration may
  relax the latter constraint without replacing identities.
- Church-owned data is always selected through a server-derived tenant context.
  A client-supplied church identifier is never authorization evidence.
- Public sign-up is unavailable. Only the protected platform-operator
  provisioning use case may create a church user. Issue #43 must prove that the
  chosen Better Auth provisioning API and the church/membership transaction
  cannot leave an active orphan identity or tenant.

### Password and recovery

- Enable only email/password authentication initially. Do not enable OAuth,
  magic links, JWT/bearer, organization, or cross-domain cookie plugins.
- Use Better Auth's default `scrypt` password hashing. Store only its encoded
  password hash; never log, return, or persist plaintext passwords.
- Password length is 12 through 128 Unicode code points. Do not impose composition
  rules that encourage predictable passwords. A future password policy change
  requires compatibility tests for existing hashes.
- There is no public or email-based password-reset request. Only a verified
  platform operator may start account recovery from the protected administration
  use case.
- Recovery generates a cryptographically random temporary password on the
  server. The plaintext is returned once to the operator, is never persisted or
  logged, and is communicated outside Levi using an approved out-of-band method.
- The reset transaction stores only the new `scrypt` hash, revokes every active
  session, sets `mustChangePassword`, and records non-secret audit metadata.
- A church user signing in with a temporary password may access only password
  change and logout. Successful change requires the current temporary password,
  stores a new user-selected password hash, clears `mustChangePassword`, and
  revokes every other session.
- Reset and first-login password change must be idempotent against duplicate
  submissions and must not expose whether another church account exists.

### Sessions and browser security

- Use revocable database-backed sessions, not stateless/JWT sessions.
- Sessions expire after 30 days and roll at most once per day. There is no
  indefinite `remember me` option in the initial UI.
- Keep session cookie caching disabled initially so every protected server
  operation observes revocation in PostgreSQL.
- Use a host-only, `HttpOnly`, `SameSite=Lax` cookie. It is `Secure` in every
  production-like HTTPS environment. Do not enable cross-subdomain cookies.
- Configure one exact application base URL and an exact trusted-origin allowlist.
  Never enable `disableCSRFCheck` or `disableOriginCheck`; do not use wildcard
  production origins.
- Better Auth's supported database session schema stores the opaque session token
  used for lookup. Treat the session table, token, cookies, backups, traces, and
  database access as Restricted data. This accepted limitation is preferable to
  replacing library internals with a custom unsupported token-hashing adapter.
  Reconsider the library if hashed-at-rest session identifiers become a hard
  requirement.
- Logout deletes the current session. Administrator reset, suspension, and
  explicit revoke-all delete all applicable sessions. Expired rows are removed
  by a bounded scheduled cleanup whose production mechanism is selected with
  hosting.

### Abuse prevention and logging

- Use Better Auth rate limiting backed by PostgreSQL initially so limits work
  across processes without adding Redis. Apply an endpoint-specific limit to
  login and test both allow and reject behavior. Administrator reset is protected
  by authorization, idempotency, and a bounded operation rate.
- Do not trust `X-Forwarded-For` or other proxy headers until ADR 0005 names the
  trusted production proxy path. Direct connection identity is the safe default.
- Authentication messages are generic. Logs contain an allowlisted event name,
  outcome category, internal actor ID when known, and request ID; they never
  contain passwords, temporary passwords, cookies, or session tokens.
- Email address, IP address, and user-agent metadata are collected only where
  required for identity, abuse control, or session management and follow the
  retention of the owning record.

### No outbound email dependency

The initial release does not send password, activation, verification, or reset
email and does not integrate a transactional-email provider. An email address
remains the login identifier, but account provisioning and recovery do not prove
control of that mailbox. The platform operator is responsible for validating the
church contact through the approved operational process.

Temporary credentials are never sent by Levi. Issue #43 must document the
out-of-band handoff procedure and make clear that chat transcripts, Issues, pull
requests, ordinary email, and agent prompts are not approved secret channels.

## Consequences

### Positive

- Password, cookie, session, CSRF, and rate-limit primitives use a
  maintained library rather than a Levi-specific security implementation.
- Authentication has no per-user SaaS charge and identity remains in Levi's
  PostgreSQL database.
- Database sessions provide immediate server-side revocation.
- Tenant ownership remains explicit and testable instead of being encoded in an
  authentication vendor's organization model.
- No external email account, domain, service credential, quota, or delivery cost
  is required for the initial release.

### Negative and risks

- Levi is responsible for patching Better Auth, operating its database tables,
  rate limits, secrets, temporary-credential procedures, and incident response.
- Better Auth supports only its latest version, increasing upgrade frequency and
  requiring migration rehearsal for every auth schema change.
- The Prisma adapter can generate schema but cannot apply Prisma migrations;
  Levi must review generated changes and create immutable repository migrations.
- Better Auth's database session lookup token is sensitive at rest. Database and
  backup compromise can expose active sessions until revocation or the 30-day
  expiry.
- The platform operator temporarily sees a generated password and must transmit
  it safely outside Levi. Compromise of that handoff can expose an account until
  the forced change completes.
- Creating a church plus an auth identity crosses Better Auth and Levi domain
  concerns. The implementation must prove atomicity or a safe inactive/pending
  state with deterministic compensation.

## Alternatives considered

### Auth.js Credentials

Auth.js integrates with Next.js and Prisma, but its Credentials documentation
assigns password hashing, persistence, rate limiting, and password reset to the
application. It was rejected because the selected workflow would require Levi to
build and maintain most security-critical credential lifecycle behavior.

### Hosted identity provider

Clerk, Auth0, and similar services can reduce operations and add mature account
features. They were rejected initially because the approved model is small,
email/password only, and cost-sensitive; hosted identity adds usage pricing,
external identity storage, and vendor-specific tenant concepts. Reconsider when
compliance, enterprise SSO, MFA, support, or operational staffing outweighs
those costs.

### Custom password and session implementation

A custom implementation could hash the session lookup token and match Levi's
schema exactly. It was rejected because it creates greater security-review,
upgrade, and incident-response risk than the current requirements justify.

### Email-based self-service reset

Email reset would let church users recover without a platform operator and would
avoid showing a temporary password to that operator. It was rejected for the
initial release because it requires an external delivery service, domain,
credential, deliverability operations, and possibly additional cost. Reconsider
when self-service recovery is worth that operational dependency.

## Compatibility and version policy

- Pin Better Auth and its Prisma adapter to an exact stable version.
- Use only versions whose official compatibility includes the repository's
  pinned Next.js, Node.js, Prisma, and PostgreSQL versions.
- Dependabot may propose updates; every update requires auth schema diff review,
  migration rehearsal, security advisory review, and the complete allowed/denied
  auth suite.
- Never run Better Auth's direct migration command against production. Generate
  candidate Prisma schema, review it against ADR 0007 from Issue #41, and commit
  a normal immutable migration.

## Reconsider when

- Better Auth no longer supports the pinned Levi runtime or cannot provide a
  supported migration path.
- A security requirement mandates hashed-at-rest database session identifiers.
- Multiple users per church, MFA, passkeys, SSO, invitations, or cross-device
  audience access becomes approved scope.
- Authentication operations or database-session latency fail measured service
  objectives.
- Self-service account recovery, email verification, invitations, or another
  workflow creates an approved outbound-email requirement.

## Verification

- Integration tests cover valid login, invalid login, generic errors, suspended
  identity, expired/revoked session, logout, operator reset authorization,
  session revocation, temporary-password forced change/replay, rate limits, and
  every cross-tenant denial.
- Component and E2E tests cover loading, disabled, success, error, keyboard, and
  focus behavior for operator reset and forced password change.
- Schema tests cover UUIDs, normalized case-insensitive email uniqueness,
  membership cardinality, foreign keys, expiry constraints, and deletion scope.
- A test proves production configuration cannot disable CSRF/origin checks,
  cannot trust undeclared proxies, and cannot enable cookie cache or public
  signup accidentally.
- Security checks audit the exact dependencies and accepted licenses.
- Production auth-secret smoke tests run only after explicit approval in a
  protected environment.

## References

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth email and password](https://better-auth.com/docs/authentication/email-password)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Better Auth rate limiting](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth options](https://better-auth.com/docs/reference/options)
- [Better Auth security policy](https://github.com/better-auth/better-auth/security/policy)
- [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials)
