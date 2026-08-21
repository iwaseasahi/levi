# WebARENA production architecture decision

## Issue

- Issue: #84
- Parent: #81
- Branch: `codex/issue-84`
- Base commit: `532cea3`

## Outcome

The product-owner-approved WebARENA Indigo 4 GB Tokyo single-VPS architecture,
cost boundary, recovery scope, risks, and remaining delivery gates are recorded
without creating a billed resource or production credential.

## Constraints

- Do not contract, provision, access, deploy, migrate, purchase a domain, or
  create a production secret.
- Preserve immediate human approval for every production/external action.
- Do not claim disaster recovery, HA, SLA, or provider restore capability.
- Domain cost is separate from the JPY 2,000 VPS objective.

## Plan

1. [x] Record the product-owner decision and split delivery Issues #85–#89.
2. [x] Accept ADR 0005 with provider, region, topology, cost, and version scope.
3. [x] Define operator-error RPO/RTO and explicitly exclude VPS/disk loss.
4. [x] Align open decisions, architecture index, cutover, backup, and security
       documentation with the accepted tradeoff.
5. [x] Run local quality and exact-head CI before merge.

## Decisions

- 2026-08-21 — WebARENA Indigo Linux 4 GB in Tokyo is the initial production
  target at a JPY 1,630 monthly VPS ceiling.
- 2026-08-21 — Caddy, Levi, and PostgreSQL 18 share one Ubuntu 24.04 VPS.
- 2026-08-21 — No SLA, HA, cross-region backup, or disaster recovery is claimed.
- 2026-08-21 — RPO 60 minutes and RTO 120 minutes cover logical recovery only
  while the VPS/disk remains available.
- 2026-08-21 — Domain is unowned and outside the VPS budget; Issue #88 is the
  human selection/acquisition gate.

## Verification

- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm release:checklist:dry-run`
- [x] exact-head `Quality`, `Database`, `E2E`, `Security`

PR #90 passed all four required checks on implementation commit `1109986`.
The documentation-only completion commit repeats the same checks before merge.

## Handoff or blockers

- Repository-only architecture work is unblocked.
- Issue #89 requires immediate approval before any billed VPS creation.
- Production remains blocked on Issues #85–#89 and the release gates.
