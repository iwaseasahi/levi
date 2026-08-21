# Projection window protocol

## Topology

The authenticated controller opens `/church/audience` in a new, ordinary Chrome
tab without popup window features. It retains the returned same-origin `Window`
reference for communication.
The audience contains no controls, account identifiers, or full search result
set.

## Transport and trust boundary

Messages use direct `window.postMessage` between the controller's retained
`Window` reference and the audience's `window.opener`. Both receivers require:

- `event.origin === window.location.origin`;
- `event.source` to be the exact expected window;
- `schema === "levi.projection"`;
- `version === 3`;
- a recognized message type; and
- a runtime-validated payload with no unknown fields.

Untrusted, malformed, stale-revision, and wrong-session messages are ignored.

## Messages

- Audience → controller `READY`: sent on initial load and every refresh.
- Audience → controller `NAVIGATE`: sends `previous` for `ArrowUp` and `next`
  for `ArrowDown`, together with the active projection session ID. The
  controller passes trusted requests through its serial navigation queue.
- Controller → audience `STATE`: the current chapter heading, verse number, one
  or two translation texts, font scale, blank state, and monotonic
  scroll/revision counters. When both translations are present their order is
  Japanese then English.
- Controller → audience `PING` and audience → controller `PONG`: detect a lost
  connection without treating a temporarily open window as healthy.
- Controller → audience `CLEAR`: reserved for explicit protected-state removal.

Only the current projected item is sent. The projection URL contains canonical
book/chapter/range/language coordinates and never contains verse text.

## Recovery and authorization

- A null result from `window.open` is shown as new-tab blocking.
- A closed window is detected and can be reopened with the same control.
- Refresh emits a new `READY`, causing the complete current state to be resent.
- Heartbeat loss is visible as disconnected and the user can re-display the
  audience window.
- The audience checks `/api/church/session` every 30 seconds and whenever it
  becomes visible. Any denied or failed check irreversibly clears text until the
  page is reloaded through an eligible session. Later controller messages cannot
  repopulate a failed-closed audience.

Navigation outside the initial result range and across chapter boundaries uses
the [scripture navigation contract](scripture-navigation-contract.md) without
changing this protocol envelope. Canonical book and testament boundaries use
the same current-item-only message flow.
