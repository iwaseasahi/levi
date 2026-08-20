# ADR 0004: Require an explicit authentication selection gate

- Status: proposed
- Date: 2026-08-21
- Decision owners: product owner and security owner
- Supersedes: none
- Superseded by: none

## Context

The required identity model is not yet known. Levi may need individual users,
church or team membership, roles, shared operator devices, invitations, or
offline presentation behavior. Selecting a provider before these requirements
are defined would make authorization and data ownership accidental.

Authentication proves identity; authorization decides what that identity may do.
They must be designed and tested separately.

## Decision

Do not select or integrate an authentication provider until the product owner and
security owner approve an identity and tenancy model.

The selection record must define:

- Identity types and account lifecycle.
- Tenant, church, or team ownership model.
- Roles and permissions, including denied behavior.
- Session lifetime, recovery, invitation, and revocation behavior.
- Shared-device and presentation-mode requirements.
- Audit, privacy, export, and deletion requirements.
- Hosted versus self-managed operational responsibility.

Protected routes and domain data that depends on user or tenant ownership are
blocked until this ADR is accepted or superseded.

## Consequences

### Positive

- Prevents a provider from defining the product's authorization model.
- Makes security, privacy, and lifecycle trade-offs reviewable.
- Keeps the initial unauthenticated walking skeleton reversible.

### Negative and risks

- Authenticated vertical slices cannot begin until the decision is made.
- Some early schema and routing work must avoid assuming a user model.

## Alternatives considered

### Adopt an auth library immediately

This would accelerate a login demo but could lock in the wrong tenancy or
session model. Reconsider after requirements are documented.

### Build authentication from scratch

This maximizes control but creates substantial security and maintenance risk. It
should be selected only when documented requirements cannot be met safely by a
mature library or service.

## Compatibility and version policy

The accepted solution must support the chosen Next.js release, deployment model,
database architecture, automated testing, and least-privilege credential model.
Provider versions and SDKs must be pinned and upgraded through normal quality
gates.

## Reconsider when

- Identity, tenancy, shared-device, or offline requirements are available.
- A candidate solution is validated in a disposable proof of concept.

## Verification

- Threat-model authentication and authorization boundaries.
- Test allowed and denied behavior at route, use-case, and data-access levels.
- Verify login, logout, expiry, revocation, and recovery flows end to end.

## References

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)

