# Select folder dates from Chrome's calendar

## Issue

- Issue: #136
- Branch: `codex/issue-136`
- Base commit: `cc1bcec5e062efb85d3c9fcf4d2f480b1a36ebd4`

## Outcome

The optional date in Ginmaku-style folder creation can be selected through the
latest Chrome calendar and continues to produce the existing `YYYY-MM-DD 集会名`
folder title.

## Context

- `src/app/church/saved-content-panel.tsx` currently renders a text input with a
  `YYYY-MM-DD` placeholder.
- The product supports latest Chrome only.
- The HTML date input provides Chrome's native calendar and normalizes its value
  to `YYYY-MM-DD` without a production dependency.

## Constraints

- Preserve the optional-date/required-meeting behavior and existing API shape.
- Preserve the Ginmaku black surface and ensure the native calendar affordance
  remains visible.
- Do not add a date-picker dependency when the supported browser supplies the
  required behavior.

## Non-goals

- Splitting persisted folder names into date and meeting database fields.
- Changing existing folder names or the folder edit surface.
- Supporting browsers outside the current latest-Chrome contract.

## Plan

1. [x] Replace the free-text date field with a labeled native date control.
2. [x] Align the date control's native rendering with the dark screen.
3. [x] Add component and Chromium E2E assertions for the picker contract,
       normalized title, and optional empty date.
4. [ ] Run canonical checks and merge only after exact-head CI succeeds.

## Progress

- 2026-08-23 JST — Issue #136 created; inspected the form, styles, component
  tests, Chromium E2E flow, and current Next.js Client Component/form guidance.
- 2026-08-23 JST — Implemented the native date control and dark native chrome;
  the focused component suite passes 5/5 and Chromium E2E passes 9/9.
- 2026-08-23 JST — Browser inspection confirmed a visible calendar affordance,
  `type=date`, dark rendering, and a normalized `2026-08-23` value.

## Decisions

- 2026-08-23 — Use `<input type="date">` rather than a JavaScript library.
  - Reason: latest Chrome supplies the requested calendar, the value remains
    normalized to `YYYY-MM-DD`, and no extra client bundle or maintenance surface
    is introduced.
  - Alternatives: a third-party React date picker was rejected as unnecessary
    for the single supported browser and simple date-only value.

## Risks and mitigations

- Risk: the native date affordance has insufficient contrast on the black page.
  - Mitigation: opt this control into the browser's dark color scheme and assert
    the rendered property in Chromium.
- Risk: changing the control type alters saved folder names.
  - Mitigation: retain the existing state and join logic, and assert the API
    command in component tests plus the visible folder title in E2E.

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: issue intake, browser-platform research, implementation, focused
  tests, Chromium E2E, and rendered browser inspection.
- Remaining: PR, exact-head CI, and merge.
- Blocker: none.
- Resume with: commit the verified change and prepare the PR.

## Result

Pending implementation and merge.
