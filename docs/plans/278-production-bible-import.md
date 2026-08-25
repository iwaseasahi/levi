# Safely bootstrap production PostgreSQL and import the approved Bible dump

## Issue

- Issue: #278
- Branch: `codex/issue-278`
- Base commit: `fc7b9bc9fc0563eabfa2f063032be6221352028f`

## Outcome

The immutable migration image can run the existing text-safe Ginmaku import
CLI, and a root-only host command performs production migration, encrypted
before/after backups, exact import, reconciliation, and idempotency proof from a
read-only approved dump.

## Context

- `Dockerfile.migrate.production` previously contained Prisma migrations only.
- `scripts/import-ginmaku-bible.ts` already validates, imports, reconciles, and
  emits only counts and fingerprints.
- Production data remains outside the repository and image.

## Constraints

- No Bible text, database URL, or secret may enter Git, Issues, image layers, or
  ordinary logs.
- Production execution remains an immediate human gate under
  `docs/governance/autonomy.md`.
- The default migration image entrypoint must remain Prisma migrate deploy.
- Sunday migration and import are forbidden in Asia/Tokyo.

## Non-goals

- Importing folders, accounts, or other Ginmaku data.
- Publishing or deploying an image before required CI succeeds.
- Exposing PostgreSQL on the host.

## Plan

1. [x] Identify the missing immutable import runtime.
2. [x] Add the existing import CLI to the migration image without changing its
       default entrypoint.
3. [x] Add a fail-closed production orchestrator and update the runbook.
4. [x] Run canonical checks and review the diff for secret/data leakage.
5. [ ] Merge only after all required CI succeeds.
6. [ ] Obtain immediate production approval, publish the new digest, and run the
       migration/import on WebARENA.

## Progress

- 2026-08-25 JST — Started from #278; confirmed that the published migration
  image cannot execute the checked-in import CLI.
- 2026-08-25 JST — Disposable image test exposed that production migrations do
  not create the required translation/bootstrap rows; added the existing
  idempotent seed as an explicit production bootstrap step.
- 2026-08-25 JST — Integration exposed a stale implicit Compose filename in the
  existing backup/restore rehearsal; made `compose.development.yaml` explicit.
- 2026-08-25 JST — The disposable production Compose rehearsal completed nine
  migrations, foundation bootstrap, dry-run, import, exact reconciliation, and
  an idempotent unchanged retry with synthetic data.
- 2026-08-25 JST — Canonical checks and integration tests passed. Production
  execution remains gated until the merged image digest and immediate approval
  are recorded.

## Decisions

- 2026-08-25 — Extend `levi-migrate` instead of creating an ad-hoc VPS runtime.
  - Reason: preserves one CI-built immutable privileged database artifact while
    retaining the existing default migration behavior.
  - Alternatives: install Node dependencies on the VPS or build an untracked
    image on the host; rejected as non-reproducible.

## Risks and mitigations

- Risk: importing a different dump.
  - Mitigation: require the approved SHA-256 and recheck it before any write.
- Risk: partial or mismatched Bible data.
  - Mitigation: existing Serializable import plus exact reconciliation and an
    `unchanged` retry.
- Risk: insufficient recovery point.
  - Mitigation: encrypted backups immediately before and after import.

## Verification

- [x] `pnpm check` (with non-secret HTTPS production origin overrides)
- [x] `pnpm test:integration` (14 files, 80 tests)
- [x] Production Compose rehearsal with the enhanced migration image
- [ ] Required GitHub CI checks on the exact PR head
- [x] Final diff reviewed for secrets, production data, and unsafe defaults

## Handoff or blockers

- Completed: production host, credentials, and backup public certificate.
- Remaining: CI, merge, new digest publication, and approved production
  execution.
- Blocker: none for repository implementation; production execution requires an
  immediate human approval after the exact digest is known.
- Resume with: open the PR and wait for every required CI check.
