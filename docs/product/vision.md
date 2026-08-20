# Product vision

Levi is the replacement for Ginmaku 2, a web-based worship presentation system
used to support church services.

## Intended outcome

Levi should let an authorized operator prepare and present the information needed
during a worship service with predictable behavior, clear controls, and
recoverable data. Replacement work should preserve required real-world workflows
while removing accidental constraints of the legacy implementation.

## Product principles

- **Service reliability first:** an ordinary software fault should not create
  avoidable disruption during a worship service.
- **Operator clarity:** the current state, next action, and audience-visible result
  should be understandable under time pressure.
- **Safe preparation:** editing and rehearsal should not accidentally affect a
  live presentation or production data.
- **Verifiable parity:** replacement claims require evidence from the legacy
  behavior, tests, fixtures, screenshots, or approved product decisions.
- **Accessible output:** audience and operator interfaces should follow applicable
  accessibility practices.
- **Recoverability:** important data and operational state need explicit backup,
  restore, and failure-recovery behavior.
- **Agent-maintainable:** architecture, specifications, and quality gates must let
  coding agents implement and validate changes without hidden human knowledge.

## Success evidence

Success is demonstrated incrementally through the parity matrix and vertical
slices. Each accepted slice must define its users, workflow, expected displayed
result, data behavior, failure behavior, and automated verification.

This document intentionally does not claim which legacy features are required.
That decision belongs in the migration parity work and product Issues.

