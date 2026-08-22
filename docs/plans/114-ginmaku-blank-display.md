# Add Ginmaku blank/display control to scripture projection

## Issue

- Issue: #114
- Branch: `codex/issue-114`
- Base commit: `89e51a64a6fc9649d5f167532658678d28707e03`

## Outcome

The retained scripture search screen toggles its connected audience tab between
Ginmaku's black blank surface and the latest scripture display.

## Context

- Ginmaku's `button_to_blank` renders `空白⇔表示`; `wipe_remote()` invokes
  `wipe()` in the named `projector` window, which toggles the content container.
- Levi already retains the direct audience Window reference and sends strict,
  same-origin, versioned font and navigation commands after a READY handshake.
- The compatibility controller protocol has blank state, but the primary direct
  audience protocol did not expose it.

## Constraints

- Preserve the direct window trust boundary and strict runtime validation.
- Preserve current location and font scale while blank; allow navigation and
  show its latest result when unblanked.
- Do not persist blank state or add song, slide, or half-screen behavior.
- Merge only after protected exact-head CI succeeds.

## Non-goals

- Redesigning the compatibility projection controller.
- Adding controls to the audience-facing tab.

## Plan

1. [x] Pin Ginmaku source behavior and map it to the direct audience protocol.
2. [x] Add the control, blank rendering state, and unit/component coverage.
3. [x] Update product contracts and parity evidence.
4. [x] Run focused and canonical verification, then review the complete diff.
5. [ ] Open a PR, pass exact-head protected CI, merge, and close the Issue.

## Progress

- 2026-08-22 10:58 JST — Confirmed Ginmaku's helper label, remote call, and
  content-container toggle at legacy commit
  `4b18adb02ac8011630c76137c60038e168f05534`.
- 2026-08-22 10:58 JST — Added `toggle-blank` to the direct protocol, placed the
  search control beside Open/Reset, retained navigation while blank, and added
  protocol/component/two-tab E2E coverage.
- 2026-08-22 11:06 JST — Passed focused protocol/component tests, typecheck,
  canonical check/build, database checks, 72 integration tests, 9 latest-Chrome
  E2E tests, security checks, and whitespace validation.

## Decisions

- 2026-08-22 — Decision: extend direct protocol version 1 with an additive
  `toggle-blank` action.
  - Reason: old receivers safely ignore the unknown action, while changing the
    envelope version would temporarily disable every existing control across
    tabs during an application update.
  - Alternatives: opening a new blank tab or using CSS from the opener was
    rejected because either breaks the named audience lifecycle or crosses the
    window boundary without the validated protocol.
  - ADR: not required; this extends the accepted projection protocol.

## Risks and mitigations

- Risk: blanking discards the current scripture or blocks navigation.
  - Mitigation: blank controls rendering only; component and E2E tests navigate
    while blank and verify the latest scripture after unblank.
- Risk: an untrusted window blanks protected output.
  - Mitigation: reuse the existing exact-origin and exact-Window validation and
    cover foreign-window rejection.

## Verification

- [x] focused unit/component tests
- [x] `mise exec -- pnpm check`
- [x] database, integration, E2E, and security checks
- [x] `git diff --check`
- [x] final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: investigation, implementation, tests, contracts, canonical
  verification, and implementation self-review.
- Remaining: pull request, protected exact-head CI, and merge.
- Blocker: none.
- Resume with: commit the verified diff and open the pull request.

## Result

Pending verification and merge.
