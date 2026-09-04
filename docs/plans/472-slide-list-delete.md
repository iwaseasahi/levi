# Delete a Slide from the Slide list

## Issue

- Issue: #472
- Branch: `codex/issue-472`
- Base commit: `b65c78fe7901031171f794abc1caef0169d24565`

## Outcome

Each Slide row exposes a delete button immediately to the right of its favorite
button. A confirmed deletion removes the Slide from the current list without a
page navigation, while cancellation and failures leave it in place.

## Context

- `src/app/slides/slide-list.tsx` owns list loading, pagination, and favorite
  actions.
- `DELETE /api/church/slides/[id]` already enforces church ownership and
  optimistic revision checks.
- The editor already uses the approved title-bearing irreversible-delete copy.

## Constraints

- Reuse the existing authenticated deletion route and send the listed revision.
- Keep favorite and delete mutations serialized and fail closed on unexpected
  responses.
- Preserve accessible names, focusable native controls, and responsive layout.

## Non-goals

- Bulk deletion, trash/undo, API or authorization changes, and list backfilling
  after deletion.

## Plan

1. [x] Add list-owned deletion state, confirmation, error handling, and immediate
       removal after a 204 response.
2. [x] Place and style the delete button to the right of the favorite action on
       desktop and mobile layouts.
3. [x] Cover cancel, pending, failure, success, positioning, and persistence with
       component and E2E tests; run applicable canonical checks.

## Progress

- 2026-09-04 14:25 JST — Created and read Issue #472; inspected ADR 0015, the
  Slide product contract, the list/editor/API implementations, current tests,
  styles, and the version-matched Next.js client/mutation documentation.
- 2026-09-04 14:35 JST — Added confirmed revision-bound deletion, serialized row
  actions, immediate post-204 removal, responsive right-side placement, and
  focused component coverage. All 113 component tests and typecheck pass.
- 2026-09-04 14:40 JST — All 35 Chromium E2E tests pass, including native-dialog
  cancel/confirm, database persistence, and measured right-side placement. The
  generated 390px and 1280px screenshots were visually reviewed with no overflow.
- 2026-09-04 14:47 JST — The complete canonical check, the standalone security
  check, and the final whitespace check pass.

## Decisions

- 2026-09-04 — Decision: reuse the list row's revision with the existing DELETE
  endpoint and remove the row locally only after HTTP 204.
  - Reason: this preserves tenant and concurrency policy while giving immediate
    feedback without an unnecessary page navigation.
  - Alternatives: linking to the editor adds an extra step; optimistic removal
    before the response risks hiding a failed deletion.

## Risks and mitigations

- Risk: duplicate or overlapping favorite/delete mutations.
  - Mitigation: synchronously guard deletion and disable both action types while
    either row mutation is pending.
- Risk: an unexpected success response is treated as deletion.
  - Mitigation: accept only the endpoint's documented HTTP 204 response.

## Verification

- [x] `pnpm test:component` — 25 files / 113 tests passed
- [x] `pnpm test:e2e` — 35 Chromium tests passed
- [x] `pnpm check` — 77 unit files / 488 tests, 25 component files / 113 tests,
      configuration checks, production build, and all other canonical checks
      passed
- [x] `pnpm security:check` — OSV audit passed with no high or critical findings;
      314 production dependency license records approved
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: Issue intake, branch isolation, implementation, local verification,
  and final diff review.
- Remaining: commit, PR, and exact-head CI.
- Blocker: none.
- Resume with: commit the scoped files and open the pull request.

## Result

The Slide list now supports confirmed, revision-bound deletion from a button
immediately to the right of the favorite action. Cancellation and failures retain
the row, successful deletion removes it without navigation, and component/E2E
coverage verifies behavior and responsive placement.
