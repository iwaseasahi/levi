# Match Ginmaku folder accordion and drag ordering

## Issue

- Issue: #116
- Branch: `codex/issue-116`
- Base commit: `9e9795190eaec2a8004c99232cf0ace225dee215`

## Outcome

The scripture search sidebar matches Ginmaku's folder workflow: collapsed
folder headers, explicit new-folder form toggle, and drag ordering of scripture
bookmarks within the open folder.

## Context

- The user-provided Ginmaku screenshot is the binding visual reference for the
  closed folder list and new-folder action.
- At pinned legacy commit `4b18adb02ac8011630c76137c60038e168f05534`,
  `app/views/shared/_bookmark.html.erb` uses an accordion, toggles the hidden
  new-folder form, and applies sortable behavior to each bookmark list.
- Levi already validates and persists a complete same-folder bookmark ID order;
  this Issue needs no schema or API change.
- The current panel permanently shows its create form, cannot close a selected
  folder, and exposes only up/down ordering controls.

## Constraints

- Keep church scoping, strict complete-order validation, pin/recent semantics,
  and physical deletion unchanged.
- Permit drag only within the currently open folder.
- Keep up/down buttons as a keyboard-accessible fallback.
- Do not add a drag dependency; latest desktop Chrome provides the required
  HTML drag-and-drop events.
- Merge only after protected exact-head CI succeeds.

## Non-goals

- Cross-folder bookmark moves or draggable folders.
- A separate Ginmaku folder-edit tab.
- Schema, API shape, touch-specific drag library, song, or slide changes.

## Plan

1. [x] Confirm legacy and current behavior, backend capability, and acceptance
       evidence.
2. [x] Implement the accordion and new-folder form toggle with Ginmaku styling.
3. [x] Implement same-folder drag ordering, visual state, keyboard fallback, and
       failed-request recovery.
4. [x] Add component/integration/latest-Chrome E2E coverage and update product
       and parity documentation.
5. [ ] Run canonical checks, self-review, exact-head CI, merge, and close #116.

## Progress

- 2026-08-22 11:12 JST — Read Issue #116, current panel/API/repository tests,
  user reference, and the pinned Ginmaku accordion/sortable implementation.
- 2026-08-22 11:45 JST — Implemented the one-open-folder accordion, toggled
  creation form, Ginmaku visual treatment, native same-folder drag ordering,
  keyboard fallback, rejected-request recovery, and automated coverage.

## Decisions

- 2026-08-22 — Decision: use native HTML drag-and-drop and retain up/down
  buttons.
  - Reason: it matches the requested latest-Chrome desktop flow without a new
    dependency while preserving keyboard operation.
  - Alternatives: a third-party sortable package adds supply-chain and bundle
    cost; pointer-only custom dragging would lose native semantics.
  - ADR: not required; this is a reversible UI implementation choice.

## Risks and mitigations

- Risk: a partial or cross-folder order corrupts positions.
  - Mitigation: derive and submit every ID from the selected folder; retain the
    server's exact-set validation and integration tests.
- Risk: drag failure leaves misleading local order.
  - Mitigation: do not optimistically commit order and reload the selected
    folder after a rejected request.
- Risk: drag is inaccessible by keyboard.
  - Mitigation: retain labelled up/down buttons and cover both paths.

## Verification

- [x] focused component and integration tests
- [x] `mise exec -- pnpm check`
- [x] database, integration, E2E, and security checks
- [x] latest Chrome create toggle, accordion, drag, persistence scenario
- [x] `git diff --check`
- [x] final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: investigation, Issue scope, and execution plan.
- Remaining: canonical verification through protected merge.
- Blocker: none.
- Resume with: run the canonical local verification suite.

## Result

Pending implementation and verification.
