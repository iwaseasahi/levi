# Projection window protocol

## Topology

The primary Ginmaku-compatible flow keeps the authenticated search screen open
at `/scripture` and opens `/scripture/audience` directly in a new, ordinary
Chrome tab named
`projector`, without popup window features. Canonical search coordinates are in
the URL; the audience fetches its own current scripture and handles `ArrowUp`
and `ArrowDown` navigation through the authenticated APIs. It contains no
controls, account identifiers, or full search result set.

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

The scripture audience reserves only its rendered heading row, then uses the
remaining viewport as the measured body region. The right-aligned heading ends
approximately 5% from the viewport's right edge. Japanese and English lines use
a one-em grid gap without outer paragraph margins, preserving the legacy visual
separation while retaining the expanded body region. The 100% body base is 80px;
the selected 60–220% scale is applied first, then the iterative fit scale reduces
it only when needed so the heading and complete body remain inside the viewport
without scrolling or clipping. Slide layout remains separate.

The direct channel uses schema `levi.direct-audience`, version `2`. Every strict
envelope includes content kind (`scripture` or `slide`) and a random connection
generation. Open places only that nonce in `#levi=<uuid>`, retaining canonical
content coordinates in the query. No text, author or account data is transported
in the fragment. Search accepts messages only from its retained audience Window
and exact origin; the audience checks its retained opener, origin and current
fragment generation. Reusing the named tab transfers its opener to the new
controller. An old controller cannot operate the new generation or content kind.

The audience sends a strict `HELLO` with its new document instance at startup.
An unseen instance disables the controller until a fresh handshake; retired
instances cannot trigger reconnection. No content/state from HELLO is adopted.
The controller sends `CONNECT` with a fresh challenge on Open, HELLO and once per second.
The audience echoes it in `READY` with a random per-document instance ID,
monotonic sequence, presentation state and adapter-validated content coordinates.
Each challenge is accepted once. A new document instance distinguishes reload
from delayed acknowledgements on the same Window. Subsequent `ACK` messages must
match generation/kind/instance and increase the sequence. Presentation state is
limited to readiness, authorization, font scale and blank. Scripture coordinates
and Slide page/revision state are validated by their respective adapters; no body
is sent in these acknowledgements.

`CONTROL` carries its own increasing sequence, exact instance and a strict action.
The audience rejects duplicate/out-of-order operations, stale identity, unknown
fields and every command after authorization fails closed. `select-page` has a
nonnegative integer transport bound (24,999); the Slide adapter additionally
enforces its actual page count. The controller displays acknowledged state only.
Unmodified ArrowUp/Down use the same navigation path as buttons. The shared
default leaves inputs, textarea, selects and editable elements alone; the
scripture adapter explicitly retains its existing search-field arrow behavior.
Slide editors never opt in. IME and modified shortcuts keep their native keys.

After five seconds without a valid response, one consecutive heartbeat check
confirms that the audience is still open before disabling controls with a reopen
instruction. Periodic probe delivery failures use this same grace period because
a closing `WindowProxy` can reject a message before its `closed` flag settles.
An unauthorized acknowledgement disables controls immediately but likewise waits
one monitoring cycle before showing its warning, so an audience teardown cannot
flash an authorization error before `closed` settles. A live unauthorized tab
still shows the existing warning after that grace. A confirmed closed tab disables
controls silently, and probes can reconnect to a compatible live page. Browser
timer throttling may delay background detection. This heartbeat never transfers
text or invokes remote functions. Version 1 and malformed messages are ignored;
incompatible tabs cannot enable controls and users are instructed to refresh both
screens and Open again.

## Recovery and authorization

- A null result from `window.open` is shown as new-tab blocking.
- A closed direct audience tab can be reopened with `Open` from the unchanged
  search screen.
- Refresh reloads the scripture identified by the canonical audience URL.
- Pagehide acknowledges not-ready and invalidates the old document. Chrome may
  deliver an unload message with an unverifiable source, which is still rejected;
  the new document's HELLO establishes the fresh handshake. A restored back/forward
  cached document reloads and reauthorizes instead of reviving old content.
- A new Open of identical coordinates changes the fragment; the audience clears
  its old authorization state and reloads to establish the new generation.
  Scripture font scale resets to the validated browser-local default (100% when
  missing or invalid), Slide font scale resets to 100%, and blank resets. Late
  old-document loads are discarded.
- The audience checks `/api/church/session` every 30 seconds and whenever it
  becomes visible. Any denied or failed check irreversibly clears text until the
  page is reloaded through an eligible session. Later direct control messages
  cannot repopulate a failed-closed audience.

Navigation outside the initial result range and across chapter boundaries uses
the [scripture navigation contract](scripture-navigation-contract.md) without
changing this protocol envelope. Canonical book and testament boundaries use
the same current-item-only message flow.

## Slide adapter delivery

Issue #386 migrates scripture to this v2 foundation with regression coverage.
The [slide contract](slide-contract.md) keeps Slide content/navigation separate;
Issue #387 supplies that adapter. No persisted presentation, localStorage content
cache, WebSocket service or external provider is introduced. Mixed v1/v2 rollout
fails closed; application rollback requires reloading both windows together.
