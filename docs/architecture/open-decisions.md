# Open decisions

These decisions require human ownership because they materially affect product
behavior, risk, access, cost, or production operations. A coding agent may
research and propose options but must not silently choose one.

| Decision | Owner | Decision deadline | Blocks | Current action |
| --- | --- | --- | --- | --- |
| Identity, tenancy, and authentication solution | Product owner + security owner | Before the first authenticated vertical-slice Issue starts | Protected routes, user-owned data, invitations, roles | Complete ADR 0004 requirements and evaluate candidates |
| Production deployment platform and region | Product owner + operations owner | Before production infrastructure or deploy workflow starts | Production deploy, production credentials, SLO claims | Complete ADR 0005 requirements and run disposable proofs of concept |
| Access to the current Ginmaku application, source, schema, and approved sample data | Repository owner | Before Issue #11 can collect parity evidence | Evidence-backed parity matrix and migration mapping | Provide read access or record the unavailable sources |
| Initial replacement scope and first vertical slice | Product owner | Before product behavior beyond the walking skeleton is implemented | Feature implementation and prioritization | Classify legacy capabilities as must/should/won't |
| Supported browsers, displays, connectivity, and offline/degraded requirements | Product owner + operations owner | Before presentation-engine architecture is accepted | Presentation reliability and caching architecture | Document real worship-service environments and failure tolerance |

When a decision is made, create or accept the relevant ADR, link the approving
Issue or record, and replace the table row with a reference to that decision.

