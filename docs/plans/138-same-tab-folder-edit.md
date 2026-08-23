# Open folder editing in the current tab

## Issue

- Issue: #138
- Branch: `codex/issue-138`
- Base commit: `a58b278520358c513d0b437c34a7b35229736c2d`

## Outcome

Selecting `フォルダの編集` performs a normal same-tab navigation to the current
folder editor, and completing or deleting a folder returns through the same
scripture-search tab.

## Context

- `SavedContentPanel` currently adds `target="_blank"` to the edit link.
- The Chromium flow waits for a new editor page and explicitly closes it.
- Folder deletion currently calls `window.close()`, which is only appropriate
  for the old separate-tab flow.

## Constraints

- Preserve folder/bookmark editing, tenant isolation, and the existing `Back`
  navigation.
- Preserve separate audience projection tabs; only folder editing changes.
- Do not change API or database contracts.

## Non-goals

- Redesigning the folder management surface.
- Changing bookmark projection or audience-tab behavior.

## Plan

1. [x] Remove the new-tab target from the folder edit link.
2. [x] Return to scripture search in the current tab after folder deletion.
3. [x] Update component, Chromium E2E, and product-contract coverage.
4. [ ] Run canonical checks and merge only after exact-head CI succeeds.

## Progress

- 2026-08-23 JST — Issue #138 created; traced the edit, Back, bookmark-edit,
  delete, and audience-tab paths in the current Chromium scenario.
- 2026-08-23 JST — Converted the edit and deletion lifecycle to same-tab
  navigation; focused component tests pass 7/7 and Chromium E2E passes 9/9.
- 2026-08-23 JST — Browser inspection confirmed no `target`, one tab before and
  after the click, the expected editor URL, and the visible editing surface.
- 2026-08-23 JST — Replaced the initial location assignment with App Router
  `replace` after lint identified the framework-native navigation requirement;
  deletion now has focused component coverage and E2E remains 9/9.

## Decisions

- 2026-08-23 — Keep standard anchor navigation rather than adding client-side
  routing behavior.
  - Reason: removing `target` directly matches the requested browser behavior
    and keeps the link functional without JavaScript.
- 2026-08-23 — Navigate to `/scripture` after physical folder deletion.
  - Reason: the current tab can no longer be closed; the deleted resource's edit
    URL must not remain visible.

## Risks and mitigations

- Risk: the E2E flow accidentally stops validating the separate audience tab.
  - Mitigation: retain its explicit new-page assertion while converting only
    folder-editor navigation to same-page URL assertions.
- Risk: deletion leaves the browser on an invalid editor URL.
  - Mitigation: assert automatic same-tab return and the folder's absence.

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: issue intake, implementation, focused tests, Chromium E2E, and
  rendered browser verification.
- Remaining: PR, exact-head CI, and merge.
- Blocker: none.
- Resume with: commit the verified change and prepare the PR.

## Result

Pending implementation and merge.
