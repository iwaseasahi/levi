# Move Bible screens to the scripture route namespace

## Issue

- Issue: #122
- Branch: `codex/issue-122`
- Base commit: `a6d92c778de2430e28b6a3427ca00426aa7cb1de`

## Outcome

The Bible search workflow is available under `/scripture`, its audience under
`/scripture/audience`, and its legacy controller under
`/scripture/controller`; the former `/church` screen routes no longer exist.

## Context

- The current `src/app/church/**/page.tsx` files make the three `/church`
  routes public in the Next.js App Router.
- Login, forced-password-change completion, audience-window creation,
  bookmarks, tests, and product contracts embed the old paths.
- `/api/church/session` describes church-scoped authorization and is explicitly
  outside this route-only change.

## Constraints

- Do not add a redirect, rewrite, alias, or compatibility page for an old route.
- Preserve authentication, tenant scoping, query shape, named-window behavior,
  and all search/audience/controller UI behavior.
- Keep existing implementation components reusable; only page entry points and
  URLs need to move.
- Merge only after exact-head protected CI succeeds.

## Non-goals

- Renaming church domain types, folders, the session API, or authorization code.
- A component-directory refactor unrelated to public URLs.

## Plan

1. [x] Inventory route entry points, navigation producers, tests, and contracts.
2. [x] Replace the three public page entry points with `/scripture` routes and
       remove the old entry points.
3. [x] Update login/password/audience/bookmark URL producers and component tests.
4. [x] Update E2E and product contracts, including explicit old-route 404 proof.
5. [ ] Run canonical verification, self-review, protected CI, merge, and close.

## Progress

- 2026-08-22 12:20 JST — Created and read Issue #122; inspected every `/church`
  screen-path reference, App Router page boundaries, and redirect behavior.
- 2026-08-22 12:35 JST — Added the three `/scripture` pages, removed all old
  page entry points, updated navigation producers/contracts, and passed 21
  focused component tests plus all 9 latest-Chromium E2E scenarios, including
  authenticated 404 assertions for every old route.

## Decisions

- 2026-08-22 — Decision: add thin `/scripture` page entry points that reuse the
  existing church-scoped implementation components, and delete only the old
  page entry points.
  - Reason: URL ownership and church authorization are separate concerns; this
    keeps the patch focused and avoids a large no-behavior component move.
  - Alternatives: moving every component directory adds review noise; retaining
    old page files would violate the requested no-old-path behavior.
  - ADR: not required; the route contract is recorded in product documentation.

## Risks and mitigations

- Risk: a stale producer opens or returns to a removed path.
  - Mitigation: repository-wide path search plus component and full E2E tests.
- Risk: old paths redirect through login and appear compatible.
  - Mitigation: request them while authenticated and assert 404 with no redirect.
- Risk: named-window control rejects messages after the origin path changes.
  - Mitigation: exercise direct audience controls and bookmark reopen in E2E.

## Verification

- [x] focused component tests
- [x] `mise exec -- pnpm check`
- [x] latest-Chromium new-route workflow and old-route 404 checks
- [x] database, integration, and security checks
- [x] `git diff --check`
- [x] final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: Issue intake, route/reference inventory, and plan.
- Remaining: protected PR verification and merge.
- Blocker: none.
- Resume with: commit, push, and open the Issue #122 PR.

## Result

Pending implementation and verification.
