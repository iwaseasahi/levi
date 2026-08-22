# Open decisions

These decisions require human ownership because they materially affect product
behavior, risk, access, cost, or production operations. A coding agent may
research and propose options but must not silently choose one.

| Decision                                                                             | Owner                            | Decision deadline                                          | Blocks                                           | Current action                                                                                              |
| ------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Presentation connectivity and degraded-mode requirements beyond same-browser windows | Product owner + operations owner | Before claiming resilience beyond the initial release      | Offline guarantees and cross-device presentation | Gather worship-service evidence; initial release guarantees latest Chrome and two same-session windows only |
| Production domain, registrar, DNS owner, and final origin                            | Product owner + operations owner | Before domain purchase, DNS, TLS, or production auth setup | Public URL, TLS, Better Auth production origin   | Resolve Issue [#88](https://github.com/iwaseasahi/levi/issues/88); domain cost is outside the VPS ceiling   |

When a decision is made, create or accept the relevant ADR, link the approving
Issue or record, and replace the table row with a reference to that decision.

Production hosting and region are resolved by
[`0005-deployment-selection-gate.md`](0005-deployment-selection-gate.md):
WebARENA Indigo Linux 4 GB in Tokyo with an accepted single-VPS/no-DR tradeoff.

Resolved product decisions are recorded in
[`../product/initial-release-spec.md`](../product/initial-release-spec.md): the
initial scope and first slice, one church user per church, email/password and
platform-operator-managed reset, latest Chrome, separate search/audience tabs,
and Bible-only migration.

Identity, tenancy, authentication, database sessions, and administrator-managed
reset behavior are resolved by
[`0006-better-auth-database-sessions.md`](0006-better-auth-database-sessions.md).

The normalized logical/physical schema, ownership, constraints, indexes, and
delete behavior are resolved by
[`0007-normalized-data-model.md`](0007-normalized-data-model.md). The product
owner approved the local production dump, JSS3/NKJV mapping, Bible-text use,
unchanged `books` rows, and preservation of five blank verse texts. Issues #47,
#48, and #56 preserve anonymous profiling, reconciliation, and restore evidence.
Any production import remains a separate immediate human approval.
