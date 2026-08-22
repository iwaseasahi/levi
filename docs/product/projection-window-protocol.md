# Projection window protocol

## Topology

The primary Ginmaku-compatible flow keeps the authenticated search screen open
at `/scripture` and opens `/scripture/audience` directly in a new, ordinary
Chrome tab named
`projector`, without popup window features. Canonical search coordinates are in
the URL; the audience fetches its own current scripture and handles `ArrowUp`
and `ArrowDown` navigation through the authenticated APIs. It contains no
controls, account identifiers, or full search result set.

The `/scripture/controller` route remains compatible with the synchronization
protocol below, but search and bookmark `Open` actions do not pass through it.

## Direct audience controls

The search screen retains the exact `Window` reference returned by `Open` and
enables its Ginmaku controls only after that audience replies with a versioned
`READY` message. It sends runtime-validated `CONTROL` messages for:

- `font-larger` and `font-smaller`, clamped to 60–220%;
- `previous` and `next`, displayed as Ginmaku's `スクロール ↑／↓` controls;
  and
- `toggle-blank`, displayed as Ginmaku's `空白⇔表示` control.

As in Ginmaku, `スクロール` changes the current scripture item; it does not
move the viewport by a pixel offset. It uses the same serial navigation path as
the audience's Up/Down keyboard controls, including selected-range, chapter,
and book boundaries. Blank hides all audience scripture on the existing black
surface without discarding the current location or font scale. Navigation
remains active while blank, and unblank displays the latest location.

The direct channel uses schema `levi.direct-audience`, version `1`. Search
accepts `READY` only from its retained audience reference and same origin. The
audience accepts `CONTROL` only from its `window.opener` and same origin. Both
message shapes are strict, and the audience ignores every control after its
session has failed closed. A closed audience disables the search controls; a
new `Open` establishes a new ready handshake.

## Legacy controller transport and trust boundary

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
- A closed direct audience tab can be reopened with `Open` from the unchanged
  search screen.
- Refresh reloads the scripture identified by the canonical audience URL.
- Heartbeat loss is visible as disconnected and the user can re-display the
  audience window when using the retained controller compatibility route.
- The audience checks `/api/church/session` every 30 seconds and whenever it
  becomes visible. Any denied or failed check irreversibly clears text until the
  page is reloaded through an eligible session. Later controller messages cannot
  repopulate a failed-closed audience.

Navigation outside the initial result range and across chapter boundaries uses
the [scripture navigation contract](scripture-navigation-contract.md) without
changing this protocol envelope. Canonical book and testament boundaries use
the same current-item-only message flow.
