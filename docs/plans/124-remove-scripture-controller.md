# Remove the obsolete scripture controller screen

## Issue

- Issue: #124
- Branch: `codex/issue-124`
- Base commit: `c73fe35fdb7a7b46c7dcf19cf77f0eaf0dd66ad9`

## Outcome

`/scripture/controller` and its controller-only transport, components, tests,
and styles no longer exist. Search continues to open the query-backed audience
screen directly at `/scripture/audience`.

## Context

- `src/app/scripture/controller/page.tsx` exposes the compatibility screen.
- `src/app/church/projection/projection-controller.tsx` and
  `src/domain/projection/state.ts` implement the legacy controller protocol.
- `src/app/church/audience/audience-display.tsx` is the queryless audience side
  of that protocol; the primary flow uses `direct-audience-display.tsx`.
- `tests/e2e/scripture-search.spec.ts` still treats the compatibility controller
  as a supported route.

## Constraints

- Do not redirect `/scripture/controller`.
- Preserve `/scripture` to `/scripture/audience` direct projection behavior.
- Preserve direct audience controls, keyboard navigation, and authorization.
- Merge only after all required checks pass on the exact head commit.

## Non-goals

- Search or audience visual redesign.
- Renaming church-scoped authentication APIs.
- Reintroducing any former `/church` screen route.

## Plan

1. [x] Remove the controller route and controller-only implementation surface.
2. [x] Make the audience route query-backed only and remove the legacy protocol.
3. [x] Update product contracts and add explicit non-redirecting 404 coverage.
4. [ ] Run focused and canonical verification, then open and merge the PR after CI.

## Progress

- 2026-08-22 JST — Started from `main`; inspected route, transport, tests, and product contracts.
- 2026-08-22 JST — Removed the compatibility route, controller and queryless-audience components, legacy projection state protocol, related tests, and controller CSS.
- 2026-08-22 JST — Added authenticated no-redirect 404 coverage for `/scripture/controller`; retained direct audience component and protocol coverage.
- 2026-08-22 JST — Local verification passed. The first E2E run encountered a non-deterministic Next.js development Performance measurement error in two unrelated auth flows; an unchanged full rerun passed all 9 tests.

## Decisions

- 2026-08-22 — Delete rather than redirect the route.
  - Reason: the user explicitly said the screen is unnecessary; direct audience is the canonical flow.
  - Alternatives: redirect to `/scripture` or retain a compatibility alias; rejected because they preserve an obsolete public URL.
- 2026-08-22 — Remove the queryless legacy audience mode together with the controller.
  - Reason: it has no remaining producer after controller removal and exists solely for the legacy transport.
  - Alternatives: retain unreachable compatibility code; rejected as dead behavior.

## Risks and mitigations

- Risk: removing shared projection code could affect direct controls.
  - Mitigation: retain `direct-audience-control.ts`, run its unit/component tests, and exercise direct projection in E2E.
- Risk: Next.js may still expose the deleted route through an alias.
  - Mitigation: add an authenticated request assertion for 404 with redirects disabled and inspect the production route list.

## Verification

- [x] `pnpm check` — 139 unit tests, 30 component tests, lint, typecheck, configuration checks, and production build passed; route list excludes `/scripture/controller`
- [x] `pnpm db:check` — passed against isolated PostgreSQL test service; no migration or schema drift
- [x] `pnpm test:integration` — 72 passed
- [x] `pnpm test:e2e` — 9 passed in latest Chromium on unchanged rerun
- [x] `pnpm security:check` — no known vulnerabilities; 314 approved production license records
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation and local verification.
- Remaining: commit, PR, required CI, merge, and synchronization.
- Blocker: none.
- Resume with: commit the verified implementation and open the PR.

## Result

Pending.
