# Stabilize Slide sidebar folder expansion E2E interaction

## Issue

- Issue: #495
- Branch: `codex/issue-495`
- Base commit: `a462f0ce721d38ba715645bfbc92938ebeebb66c`

## Outcome

The Slide sidebar folder-expansion scenario synchronizes with the current route's
interactive sidebar before clicking its accordion toggle, remains deterministic
with Playwright retries disabled, and preserves the existing mouse, keyboard,
and accessibility behavior.

## Context

- `tests/e2e/slide-list.spec.ts` currently waits for `/slides`, a visible
  `#bookmark_container`, and an expanded folder before toggling it closed and
  open.
- Next.js client navigation updates the URL while retaining the previous route
  until the next route payload is ready. A visible sidebar and matching folder
  name therefore do not prove that the `/slides` client tree has mounted.
- `SavedContentPanel` exposes its request lifecycle through `aria-busy` and
  disables folder toggles while pending.
- Issue #497 / PR #500 changed which folder opens after navigation but explicitly
  left Issue #495's intermittent interaction out of scope.
- The original failed trace is no longer present in the retained local
  artifacts, so the current implementation must be evaluated through a
  retries-zero repeated run and a deterministic regression at the synchronization
  boundary.

## Constraints

- Do not add Playwright retries, arbitrary sleeps, or broad timeout increases.
- Preserve role-based locators, mouse/keyboard behavior, accessible names, and
  `aria-expanded` semantics.
- Use only synthetic E2E fixtures; do not access production data.
- Keep the fix scoped to the test synchronization defect unless reproduction
  proves an application defect.

## Non-goals

- Changing folder ordering, persistence, or product interaction behavior.
- Redesigning the sidebar or changing Next.js navigation behavior.
- Production deployment.

## Plan

1. [x] Reproduce or stress the current scenario on unmodified `main`, recording
       whether navigation readiness, pending state, or application behavior fails.
2. [x] Add a deterministic current-route readiness assertion before the folder
       interaction and the lowest useful regression coverage for that boundary.
3. [x] Run the focused scenario repeatedly with retries zero, then the full E2E
       suite repeatedly and all canonical checks.
4. [ ] Review the diff, commit, open and complete the PR, wait for exact-head CI,
       merge, close the Issue, synchronize `main`, and release the writer lease.

## Progress

- 2026-09-07 13:25 JST — Read Issue #495, related Issues #486/#497, PR #500,
  governance, testing policy, current sidebar/controller code, and Next.js 16.3.3
  navigation documentation. Created the dedicated worktree and acquired
  `codex-495-1` writer lease.
- 2026-09-07 14:08 JST — Unmodified full E2E passed three consecutive runs
  (35/35 each, retries zero). A temporary diagnostic route held the selected
  folder GET and deterministically reproduced the reported assertion: the click
  fired, the toggle became disabled, and `aria-expanded` remained `false` while
  the controller awaited the response. Removed the diagnostic route and changed
  the test to await the route-specific heading, idle sidebar, and exact successful
  folder read before asserting expansion.
- 2026-09-07 14:14 JST — Final synchronization passed three consecutive full E2E
  runs (35/35 each, 105 total scenarios, retries zero). `pnpm check` passed after
  linking the worktree to the existing ignored local `.env`; the first attempt
  stopped at Prisma generation because the isolated worktree had no
  `DATABASE_URL`. Integration passed 26 files / 141 tests, and security passed
  with no high/critical findings and 356 approved license records.

## Decisions

- 2026-09-07 — Decision: Treat route readiness as the leading hypothesis, not a
  confirmed cause.
  - Reason: the URL and old sidebar can both satisfy the current assertions during
    a client transition; the controller already exposes a real busy/disabled
    state.
  - Alternatives: adding retries or sleep was rejected by repository policy and
    would not identify the synchronization boundary.
  - ADR: none; this is test synchronization, not a durable architecture change.
- 2026-09-07 — Decision: Synchronize on the selected-folder GET rather than
  changing application behavior or increasing a timeout.
  - Reason: deterministic response blocking proved the locator and click were
    live; `chooseFolder` intentionally publishes the expanded selection only
    after bookmark data has loaded. The previous five-second DOM assertion raced
    that request under parallel suite load.
  - Alternatives: optimistic expansion would change product behavior; a longer
    assertion timeout would retain the implicit transport race.
  - ADR: none; the application contract is unchanged.

## Risks and mitigations

- Risk: a test-only wait could hide an application interaction defect.
  - Mitigation: stress the unmodified scenario and inspect observable pending and
    route-specific state before changing the test.
- Risk: repeated E2E runs leave shared state or artifacts.
  - Mitigation: use the repository E2E runner and its disposable test DB/Mailpit
    boundaries.

## Verification

- [x] Focused Slide sidebar scenario repeated with Playwright retries zero —
      included in each full-suite run; three pre-fix baseline passes and three
      post-fix passes.
- [x] `pnpm test:e2e` repeated with Playwright retries zero — 35/35 passed in
      each of three consecutive final runs.
- [x] `pnpm check` — passed; format, lint, typecheck, unit/component, config, and
      production build succeeded.
- [x] `pnpm test:integration` — 26 files / 141 tests passed.
- [x] `pnpm security:check` — no high/critical findings; 356 approved license
      records. One existing moderate `mysql2` advisory remains governed by the
      repository audit policy.
- [x] `git diff --check` — passed.
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults —
      only the E2E synchronization and this execution plan changed; the temporary
      diagnostic route is absent.

## Handoff or blockers

- Completed: intake, deterministic diagnosis, synchronization fix, repeated
  retries-zero E2E, canonical checks, integration, security, and final review.
- Remaining: commit, PR, exact-head CI, merge, Issue closure, main sync, cleanup.
- Blocker: none.
- Resume with: commit the reviewed two-file patch and open the PR.

## Result

Pending.
