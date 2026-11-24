# Restore the production dependency audit

## Issue

- Issue: #592; prerequisite for Dependabot #589, #590 and #591.
- Branch: `codex/issue-592`.
- Base: `d75539953484743d23f7780be93a0c4d0159ece9`.

## Outcome and constraints

Resolve the existing production effect graph to its first fixed release without
changing security thresholds, license controls, Prisma, required CI or production.
Follow AGENTS.md, governance, ADR 0001 and the dependency policy. No new direct
dependency, migration, credentials, billing or production operation is needed.
Unrelated moderate advisories remain tracked by #583 and #534.

## Plan

1. [x] Inspect current paginated PR/check state, prior Issues and required docs.
2. [x] Acquire the shared writer lease and isolate this branch/worktree.
3. [x] Reproduce the production audit failure and review the upstream fix.
4. [x] Apply the exact override; verify installation, graph, audit and quality.
5. [ ] Complete protected CI and merge after separate diff review.
6. [ ] Record final evidence in the Issue/PR, release lease and synchronize main.

## Evidence and decisions

- 2026-11-24: `pnpm security:check` on unchanged main reproduced
  `effect@3.20.0:GHSA-7589-6fvf-x4pw`, OSV severity 8.7.
- `pnpm why --prod effect` locates it through `@prisma/config@7.10.1`.
- Upstream advisory identifies <=3.22.0 as affected and 3.22.1 as fixed for
  ambiguous TemplateLiteral regex evaluation. Keep the stricter OSV score even
  though the advisory summary labels it Moderate.
- Official registry metadata for 3.22.1: Effect-TS/effect repository, MIT,
  SHA-512 integrity, SLSA v1 provenance, no additional engine restriction.
- Use an exact workspace override in the existing major instead of a broad
  Prisma upgrade or an audit exception. Existing audit provides the regression
  check; protected Database/E2E verify Prisma and application integration.

## Verification

- `mise exec -- corepack pnpm install --frozen-lockfile`: passed before/after.
- `mise exec -- corepack pnpm why --prod effect`: only 3.22.1 after the override.
- `mise exec -- corepack pnpm security:check`: passed after the fix; 7 existing
  moderate/low groups remain and 348 production license records are approved.
- `mise run check`: passed (588 unit, 129 component tests; formatting, lint,
  types, configuration safeguards and production build).
- Separate final diff review: only exact existing-major override, matching
  integrity/snapshot changes and evidence; no gate/permission/migration changes.
- `git diff --check`: passed. Protected exact-head CI remains the merge gate.

## Risks and remaining work

A transitive runtime update can affect Prisma configuration. Frozen installation,
production build, Database and E2E are required. No schema/data migration.
Remaining: verification, separate diff review, exact-head protected merge.
