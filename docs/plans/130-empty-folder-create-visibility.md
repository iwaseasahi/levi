# Keep folder creation visible in the empty sidebar

## Issue

- Issue: #130
- Branch: `codex/issue-130`
- Base commit: `7731221c89b669738569152a49dfbe9f7649105a`

## Outcome

The Ginmaku-compatible folder sidebar visibly presents `⊕ 新規フォルダ作成`
when the church has no folders, and the existing creation flow remains usable.

## Context

- `SavedContentPanel` always renders the creation toggle after the folder list.
- The empty-folder E2E flow can locate and click the control, so this is not a
  conditional-rendering defect.
- In `src/app/styles.css`, the generic sidebar button selector has higher CSS
  specificity than the transparent creation-toggle selector. Chrome therefore
  keeps the system `buttontext` color, which is black in the observed local
  rendering, on a black background.

## Constraints

- Preserve the existing API, creation behavior, keyboard semantics, and
  Ginmaku-compatible layout.
- Fix the selector at the narrowest component scope.
- Verify rendered color in latest Chromium; DOM visibility alone did not catch
  the defect.

## Non-goals

- Redesigning the folder sidebar or changing folder persistence.
- Changing other native-looking Ginmaku controls.

## Plan

1. [x] Add an E2E assertion that the empty-state creation toggle renders as
       white text on the black sidebar.
2. [x] Raise only the creation-toggle rule's specificity and preserve its
       transparent Ginmaku appearance.
3. [ ] Run canonical verification and merge only after exact-head required CI
       succeeds.

## Progress

- 2026-08-23 JST — Reproduced from the supplied screenshot and traced the
  invisible text to competing CSS selectors.
- 2026-08-23 JST — Proved the regression test fails with computed black text,
  applied the scoped selector fix, and passed Chromium E2E and `pnpm check`.

## Decisions

- 2026-08-23 — Strengthen the component-scoped selector instead of adding
  `!important` or changing all sidebar buttons.
  - Reason: it directly resolves the specificity conflict without altering
    native Open/Reset and folder controls.
  - Alternatives: `!important`; rejected because ordinary scoped specificity is
    sufficient. Global button-color change; rejected as too broad.

## Risks and mitigations

- Risk: DOM-based tests may pass while foreground and background remain equal.
  - Mitigation: assert the computed foreground and background colors in E2E.

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: regression test, scoped CSS fix, and local canonical verification.
- Remaining: PR, exact-head CI, merge, lease release, and main synchronization.
- Blocker: none.
- Resume with: commit the verified change and open the PR.

## Result

The creation toggle now wins the intended CSS cascade and renders white on the
black empty sidebar. Chromium verifies its computed color, transparent
background, and the existing create/open flow.
