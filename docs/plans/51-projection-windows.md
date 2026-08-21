# Synchronized controller and audience windows

## Issue

- Issue: #51
- Branch: `codex/issue-51`
- Base commit: `0c06ce5`

## Outcome

The projection selection opens or reuses a same-origin audience window whose
display is predictably controlled from an authenticated controller window.

## Context

- Issue #50 hands canonical search coordinates to `/church/projection`.
- Issues #52 and #53 own navigation outside the initial result range.
- The audience surface must never render controller controls or tenant/account
  details.

## Constraints

- Every `postMessage` validates exact origin, source window, schema, version,
  message type, and payload.
- Only the current projected item crosses the window boundary.
- Closing, blocking, refreshing, reopening, and heartbeat loss are visible and
  recoverable without shifting controller focus unexpectedly.
- The audience clears protected text when session eligibility is lost.
- Tests contain synthetic text only.

## Non-goals

- Navigation beyond the searched result set or across chapters/books.
- Bookmark persistence.
- Cross-device or cross-browser synchronization.

## Plan

1. [x] Define and test the projection control reducer, connection states, and
       versioned message protocol.
2. [x] Replace the handoff shell with an authenticated controller that reloads
       the canonical selection and exposes direct/previous/next/font/scroll/
       blank controls.
3. [x] Add a control-free authenticated audience route with handshake,
       heartbeat, refresh recovery, and auth-expiry clearing.
4. [x] Cover popup blocking, close/reopen/reload, invalid messages, keyboard
       behavior, and two-page synchronization.
5. [x] Update parity/docs, run exact-commit CI, and merge.

## Progress

- 2026-08-21 18:45 JST — Started from merged Issue #50, acquired the writer
  lease, and confirmed the product boundary with Issues #52/#53.
- 2026-08-21 19:00 JST — Implemented the strict protocol, controller/audience
  surfaces, auth-expiry clearing, and recovery states. A two-page Chrome run
  exposed and verified the refresh re-handshake path. All nine browser scenarios
  pass using the product-owner-approved Genesis 1:1 fixture.
- 2026-08-21 19:10 JST — Quality, Database, E2E, and Security passed on
  implementation commit `74034f1`.

## Decisions

- 2026-08-21 — Use direct same-origin `window.postMessage` with a named popup.
  - Reason: source-window and origin checks are available, and a refreshed popup
    retains `window.opener` for a deterministic READY handshake.
- 2026-08-21 — Send only the current audience rendering state.
  - Reason: the audience does not need the complete result set or controller
    state, reducing protected data retained outside the controller.

## Risks and mitigations

- Risk: stale or forged messages alter the audience.
  - Mitigation: strict schema/version/origin/source validation and monotonic
    revisions.
- Risk: an expired session leaves verse text displayed.
  - Mitigation: periodic same-origin eligibility checks clear all audience
    state on any denied or failed response.

## Verification

- [x] protocol/state-machine unit tests — 97 repository unit tests passed
- [x] component/accessibility tests — 19 passed
- [x] two-page latest-Chrome E2E — all 9 repository scenarios passed
- [x] local repository gates — 52 integration tests, DB and security checks
- [x] exact-commit GitHub CI — all four required jobs passed

## Handoff or blockers

- Blocker: none.
- Resume with: implement beyond-range and chapter-boundary navigation in Issue
  #52.

## Result

Issue #51 is complete. The controller and audience are separate authenticated
surfaces with strict same-origin messaging, a recoverable handshake/heartbeat,
all current-range controls, and fail-closed session handling. Latest-Chrome
evidence covers close, reopen, reload, invalid messages, font, blank, and direct
or sequential navigation.
