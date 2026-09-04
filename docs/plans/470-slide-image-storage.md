# Store and project one image per Slide

## Issue

- Issue: #470
- Branch: `codex/issue-470`
- Base commit: `4702c6c1e089064f561915d1a008863bacdf507b`

## Outcome

Extend the existing church-owned Slide workflow with image-only Slides. Store a
validated, normalized image in PostgreSQL `bytea`, enforce a per-church quota,
serve it only through the authenticated Slide boundary, and project it on the
existing 16:9 audience surface. Keep the application storage contract independent
of PostgreSQL so a later S3 migration does not change the Slide domain or UI.

## Context

- `docs/architecture/0015-church-owned-slides.md` owns Slide storage, deletion,
  revision, tenancy, and projection decisions.
- `src/domain/slides/`, `src/application/slides/`, and
  `src/infrastructure/database/slide-repository.ts` implement the current text
  aggregate.
- `src/app/slides/` and `src/app/api/church/slides/` implement management and
  same-browser projection.
- Production is an 80 GB single VPS; encrypted logical PostgreSQL backups and
  production capacity monitoring already exist.
- Issue #470 selects PostgreSQL binary storage for the current two-church scale,
  while leaving the exact production quota as a rollout approval informed by
  representative backup and restore evidence.

## Constraints

- Preserve existing text Slides, bookmarks, URLs, revision behavior, and
  cross-tenant non-disclosure.
- Store only validated normalized JPEG, PNG, or static WebP output, never the
  original filename/file, and accept at most 10 MiB per upload.
- Binary reads must be explicit and absent from list/search/bookmark DTOs.
- Image and Slide mutations must share a database transaction; quota checks must
  remain correct under concurrency.
- Keep production migration/deploy, real data, quota approval, and any external
  storage credentials outside this implementation authority.
- Follow `docs/governance/autonomy.md`,
  `docs/governance/agent-execution-protocol.md`, `docs/testing.md`, and
  `docs/architecture/database-conventions.md`.

## Non-goals

- Multiple images, mixed text/image layout, cropping, animation, video, PDF, or
  SVG.
- Initial S3, CloudFront, local filesystem, or Docker application-volume storage.
- Legacy image import, image history, trash, cross-device or offline projection,
  and a new VPS-loss recovery objective.

## Plan

1. [x] Record the durable architecture amendment and exact domain/storage/API
       contracts, including a configurable production quota and S3 migration trigger.
2. [x] Add input validation/normalization, Slide content typing, a forward Prisma
       migration, explicit binary repository access, transactional quota enforcement,
       and focused unit/integration tests.
3. [x] Add authenticated upload/read behavior and update create/edit/detail,
       preview, audience, blanking, and image-specific controls with component tests.
4. [x] Extend E2E acceptance, threat/data handling, backup/restore reconciliation,
       capacity monitoring, and deployment documentation/tests.
5. [ ] Run focused checks, all applicable canonical checks, review the complete
       diff for security/data-loss/scope issues, and prepare a PR with exact evidence.

## Progress

- 2026-09-04 10:56 JST — Started; read Issue #470, repository instructions,
  governance/execution protocols, Slide contract/ADR/current code, testing and
  database conventions; created `codex/issue-470` and acquired its writer lease.
- 2026-09-04 11:30 JST — Implemented the typed image aggregate, bounded Sharp
  normalization, authenticated routes/UI/projection, transactional quota,
  synthetic backup reconciliation, monitoring threshold, and ADR 0016. Unit
  tests pass (481), component image tests pass (5), and integration tests pass
  (135). Full browser verification remains in progress.
- 2026-09-04 11:50 JST — Final local verification passes: `pnpm check`
  (483 unit, 111 component, production build), `pnpm db:check`, 136 integration
  tests, 34 Chromium E2E tests, and the image-aware encrypted restore rehearsal
  (4-second measured run). The canonical security policy passes via the Yarn
  npm-compatible registry because POST requests to the default npm audit endpoint
  timed out; it reports zero high/critical and one existing moderate MySQL-only
  transitive advisory. License policy approves 314 production records.

## Decisions

- 2026-09-04 — Decision: use a dedicated one-to-one image persistence boundary
  backed by PostgreSQL `bytea`, while keeping bytes out of ordinary Slide reads.
  - Reason: atomic lifecycle and inclusion in the current backup/restore workflow
    outweigh object-storage scalability at the current two-church size.
  - Alternatives: S3 is deferred; application filesystem/volume storage would
    introduce a second consistency and backup domain.
  - ADR: accepted ADR 0016 extends ADR 0015.
- 2026-09-04 — Decision: make the per-church quota validated configuration and
  require an approved production value before rollout.
  - Reason: the durable product requirement is a hard tenant quota, while its
    safe numeric value depends on backup amplification and restore evidence.
  - Alternatives: an unbounded database or an arbitrary hidden limit are unsafe.

## Risks and mitigations

- Risk: compressed image input expands enough to exhaust the 4 GB process.
  - Mitigation: bound request bytes, decoded pixels/dimensions, concurrency, and
    processing time; test adversarial inputs.
- Risk: Prisma accidentally loads `bytea` in list/search paths.
  - Mitigation: isolate the image table/repository and assert explicit query/DTO
    behavior with integration tests.
- Risk: concurrent uploads exceed the church quota.
  - Mitigation: serialize quota-changing mutations per church in a transaction
    and run a real PostgreSQL concurrency test.
- Risk: images multiply logical-backup size and breach the shared 80 GB disk or
  restore objective.
  - Mitigation: representative rehearsal, proactive DB/table/archive monitoring,
    and a rollout gate that fixes the quota only after evidence.
- Risk: a revoked audience continues showing confidential pixels.
  - Mitigation: reuse bounded audience revalidation, clear image state on every
    failure, and reject stale async responses.

## Verification

- [x] `pnpm test:unit`
- [x] `pnpm test:component`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm backup:rehearse`
- [x] `npm_config_registry=https://registry.yarnpkg.com pnpm security:check`
- [x] `pnpm check`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migration safety, authorization,
      bounded resource use, and unsafe defaults.

## Handoff or blockers

- Completed: Issue intake, repository inspection, branch and lease setup.
- Remaining: commit, PR creation, and exact-head CI handoff.
- Blocker: none. The exact production quota remains an explicit rollout gate and
  does not block implementing a required, validated configuration boundary.
- Resume with: run the image E2E after its strict locator correction, then the
  backup rehearsal and canonical checks.

## Result

Implementation and local verification are complete. Production enablement remains
blocked on human approval of the exact per-church quota and a representative-size
capacity/restore rehearsal; the checked-in one-GiB value is an example, not that
approval.
