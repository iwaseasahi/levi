# ADR 0014: Separate password setup and recovery mail with three-day validity

- Status: accepted
- Date: 2026-08-31
- Issue: #376
- Supersedes: only the token-duration clauses of ADRs 0009, 0012 and 0013.

## Context and decision

The owner requested distinct initial-setup and recovery emails and three days
to use each link. Both church and administrator Better Auth instances issue
new tokens with a 72-hour lifetime. A shared constant configures this duration.
Previously issued tokens retain their stored expiry; no data migration occurs.

The mail callback uses the framework-resolved user ID to read persisted
lifecycle state: PENDING church users and INVITED administrators receive setup
copy; ACTIVE identities receive recovery copy. The four subjects/templates are
separate, while SMTP delivery remains shared. Request parameters cannot choose
the template. Pending users requesting a replacement link still need setup.

## Consequences and alternatives

Three days increases the exposure window of an unused bearer link; this is an
explicit owner-approved usability trade-off. Single use, session revocation,
generic recovery responses, rate limits, separate auth domains, Basic auth,
and secret-free logging remain unchanged. No new dependency is needed.

Keeping the combined template was rejected because it obscures the purpose.
Client-supplied purpose and process-global invitation flags were rejected as
untrusted or unsafe under concurrent requests. Tests isolate mail transport.
