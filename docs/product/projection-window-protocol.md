# Projection window protocol

## Topology

The authenticated controller opens or reuses the named same-origin window
`levi-audience` at `/church/audience`. The controller retains its keyboard focus.
The audience contains no controls, account identifiers, or full search result
set.

## Transport and trust boundary

Messages use direct `window.postMessage` between the controller's retained
`Window` reference and the audience's `window.opener`. Both receivers require:

- `event.origin === window.location.origin`;
- `event.source` to be the exact expected window;
- `schema === "levi.projection"`;
- `version === 1`;
- a recognized message type; and
- a runtime-validated payload with no unknown fields.

Untrusted, malformed, stale-revision, and wrong-session messages are ignored.

## Messages

- Audience → controller `READY`: sent on initial load and every refresh.
- Controller → audience `STATE`: the current reference, one or two translation
  texts, font scale, blank state, and monotonic scroll/revision counters.
- Controller → audience `PING` and audience → controller `PONG`: detect a lost
  connection without treating a temporarily open window as healthy.
- Controller → audience `CLEAR`: reserved for explicit protected-state removal.

Only the current projected item is sent. The projection URL contains canonical
book/chapter/range/language coordinates and never contains verse text.

## Recovery and authorization

- A null result from `window.open` is shown as popup blocking.
- A closed window is detected and can be reopened with the same control.
- Refresh emits a new `READY`, causing the complete current state to be resent.
- Heartbeat loss is visible as disconnected and the user can re-display the
  audience window.
- The audience checks `/api/church/session` every 30 seconds and whenever it
  becomes visible. Any denied or failed check irreversibly clears text until the
  page is reloaded through an eligible session. Later controller messages cannot
  repopulate a failed-closed audience.

Navigation outside the initial result range is intentionally added by Issues
#52 and #53 without changing this protocol envelope.
