# Project saved Slides with reauthorized page navigation

- Issue #387, parent #59; dependencies #384/#386 merged.
- Branch `codex/issue-387`, base `bc27deb`; lease acquired before edits.
- Read Slide contract/ADR 0015 and installed Next 16.3.1 route-group/layout docs.

## Plan

1. [x] Add strict Slide projection coordinates and a framework-independent
       audience session with serialized navigation and irreversible failure.
2. [x] Wire saved-only controller and body-only audience to shared v2 transport
       and the existing preview fit/parser. Separate management layout by route group.
3. [x] Verify page bounds, revision/delete/auth failure, late responses, transient
       font/blank, URL reload and first/last-page behavior at unit/component levels.
4. [x] Chrome cross-kind reuse, 390/1280 controller, 1280x720/1920x1080 audience,
       literal Japanese/long-line fit, keyboard/focus and failure clearing.
5. [ ] Canonical checks, separate review, PR, exact-head required CI and merge.

## Constraints / decisions

- Revalidate saved Slide on navigation, visibility and every 30 seconds. Any failed
  check clears text; a changed revision requests reopen. Never revive a failed session.
- URL holds ID/page plus the existing connection nonce fragment, never content.
- No migration, dependency, production operation, content log/cache/history.
- Loading/error audience contains generic feedback only; no login or management UI.
- Search performance was assigned to #397 and later removed with the unused
  search API; Sunday measurement #302 remains separate.

## Progress / blockers

- Intake complete; no blocker. Final evidence will be recorded in the PR.

- 2026-08-31 — Implemented saved-only controller and audience; page/revision
  navigation is serialized and permanently fails closed. Route groups keep all
  management UI outside the audience. The shared controller accepts an adapter
  readiness predicate so mismatched Slide revisions disable keyboard commands too.
- `pnpm check`: passed (438 unit, 92 component, format/lint/types/config/build).
  `pnpm security:check`: passed, 315 licenses, no known vulnerabilities.
  `pnpm test:unit:coverage`: passed, lines 94.71%, branches 86.75%.
- Chrome projection cases passed, including both viewports and cross-kind reuse;
  manually inspected 390px controller and 1920px long Japanese line screenshots.
  First run exposed a test locator matching Next's separate route announcer;
  scoped audience alerts to its main landmark. The subsequent full suite had
  26 passes and an unrelated administration 429; investigating its root cause
  without retries or relaxing rate limits/runtime error guards.
- Separate review: no new dependency/schema, no content in URL/message metadata,
  terminal failure guards cover late requests and navigation, saved revision
  mismatch disables buttons and global keys. One projection vertical slice uses
  shared transport plus domain adapter; splitting those would expose broken UI.
- Administration fixture correction #400 merged via PR #402; incorporated main
  without rewriting history. Final full E2E and CI are rerun with this correction.
  Integration passed 128/128. No unresolved implementation finding.
