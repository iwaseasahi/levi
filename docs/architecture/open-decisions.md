# Open decisions

These decisions require human ownership because they materially affect product
behavior, risk, access, cost, or production operations. A coding agent may
research and propose options but must not silently choose one.

| Decision                                                                             | Owner                            | Decision deadline                                          | Blocks                                                | Current action                                                                                               |
| ------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Production deployment platform and region                                            | Product owner + operations owner | Before production infrastructure or deploy workflow starts | Production deploy, production credentials, SLO claims | Complete ADR 0005 requirements and run disposable proofs of concept                                          |
| Production transactional-email account, sending domain, and credential               | Product owner + operations owner | Before production password-reset email is enabled          | External email delivery and account recovery          | Evaluate the ADR 0006 Resend Free candidate in the selected region; approve account/domain/secret separately |
| Approved handling location and rights/provenance for the MySQL Bible dump            | Repository owner + content owner | Before Issue #47 reads the dump or Bible text enters Levi  | Bible profiling, import, and release                  | Approve the exact local handling boundary and each translation's permitted use                               |
| Presentation connectivity and degraded-mode requirements beyond same-browser windows | Product owner + operations owner | Before claiming resilience beyond the initial release      | Offline guarantees and cross-device presentation      | Gather worship-service evidence; initial release guarantees latest Chrome and two same-session windows only  |

When a decision is made, create or accept the relevant ADR, link the approving
Issue or record, and replace the table row with a reference to that decision.

Resolved product decisions are recorded in
[`../product/initial-release-spec.md`](../product/initial-release-spec.md): the
initial scope and first slice, one church user per church, email/password and
self-service reset, latest Chrome, separate controller/audience windows, and
Bible-only migration.

Identity, tenancy, authentication, database sessions, reset behavior, and the
transactional-email boundary are resolved by
[`0006-better-auth-database-sessions.md`](0006-better-auth-database-sessions.md).
