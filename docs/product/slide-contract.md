# Post-release slide contract

Delivery: [Issue #59](https://github.com/iwaseasahi/levi/issues/59). This is the
contract for child implementation Issues. The [acceptance map](../testing-slide-e2e.md)
records runtime verification; production rollout is separately approved.
Ownership/storage: [ADR 0015](../architecture/0015-church-owned-slides.md) and
[ADR 0016](../architecture/0016-store-slide-images-in-postgresql.md).

## Pinned legacy evidence

Inspected on 2026-08-31, observed-in-code only, at Ginmaku commit
[`4b18adb02ac8011630c76137c60038e168f05534`](https://github.com/iwaseasahi/ginmaku/tree/4b18adb02ac8011630c76137c60038e168f05534).
No production content, dump, or legacy runtime was accessed.

| Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Observed behavior                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [slide.rb](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/models/slide.rb)                                                                                                                                                                                                                                                                                                                                                                                                                                          | No field validation; CRLF then CR become LF; split at `/\n{4,}/`; Ruby drops trailing empty split elements; outline uses each page's first line; recent updates capped at 10; soft delete. |
| [create_slides.rb](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/db/migrate/20130401125430_create_slides.rb)                                                                                                                                                                                                                                                                                                                                                                                                           | Nullable title/string, body/text, author/string, deleted timestamp and creation/update timestamps; no church FK or checks.                                                                 |
| [slide_search_form.rb](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/models/slide_search_form.rb)                                                                                                                                                                                                                                                                                                                                                                                                                  | Body-only SQL LIKE substring expression; no tokenization; `%` and `_` can act as wildcards. Case/accent behavior depends on the unverified MySQL collation.                                |
| [slides_controller.rb](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/controllers/slides_controller.rb)                                                                                                                                                                                                                                                                                                                                                                                                             | CRUD, recent, ID-ordered all-list, paginated search; preview builds an unsaved Slide from body. Search has no explicit order.                                                              |
| [form](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/views/slides/_form.html.erb), [preview](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/views/slides/preview.html.erb)                                                                                                                                                                                                                                                                                                | Title/body/author inputs; explicit unsaved preview; escaped text in `pre` elements, not HTML authoring.                                                                                    |
| [show](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/views/slides/show.html.erb), [detail](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/views/slides/detail.html.erb), [slides.js.coffee](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/assets/javascripts/slides.js.coffee), [common.js.coffee](https://github.com/iwaseasahi/ginmaku/blob/4b18adb02ac8011630c76137c60038e168f05534/app/assets/javascripts/common.js.coffee) | Outline/page selection, separate named projector, bounded previous/next, Up/Down keys, blank toggle, fitted/centered text. Remote control calls window functions after a fixed timeout.    |

The source does not establish real content lengths, deployed collation, page
size, production usage, or a need to import slides. Soft delete and old bookmark
route JSON are explicitly not carried over. No legacy edit history is required.

## Fields and validation

A Slide belongs to a church, not an individual creator. All members with an
eligible church session can manage that church's slides.

| Field                    | Replacement rule                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `churchId`         | Server-owned UUIDs; church from the authenticated actor only.                                                                                                    |
| `title`                  | Required, trim leading/trailing ASCII space/tab/newline after EOL normalization, 1–200 Unicode code points, single line (no CR/LF/tab).                          |
| `body`                   | Required plain text, normalize CRLF/CR to LF, preserve other whitespace; 1–100,000 Unicode code points and at least one character other than ASCII space/tab/LF. |
| `contentType`            | Server-returned `text` or `image`; one Slide has exactly one surface. Existing rows are `text`.                                                                  |
| `image`                  | For image Slides only: media type, normalized byte size, width, and height; bytes are never embedded in Slide JSON.                                              |
| `revision`               | Server-owned positive integer, starts at 1 and increments on update; optimistic concurrency token, not edit history.                                             |
| `createdAt`, `updatedAt` | Server-owned UTC timestamps; creation time immutable.                                                                                                            |

Reject NUL and malformed Unicode; reject unknown request fields. Count code
points, not UTF-16 units. Reject excessive input without truncation, and bound
JSON request size to 1 MiB before parsing. Required title/body and explicit limits
are intentional Levi validation improvements, not observed legacy restrictions.
Issue #432 removes the former optional author attribution from Levi. Its forward
migration intentionally discards existing `slides.author` values; production
migration and deployment remain separately approved operations. Historical
Ginmaku evidence above remains unchanged and does not define the active field set.

Create/update errors retain the user's input. Invalid input is 400, missing or
foreign-tenant IDs have the same 404 response, and stale revision is 409. Update
and delete require the expected revision; they cannot silently overwrite a
concurrent edit. Success is 201 for create, 200 for read/update, 204 for delete.
POST `/api/church/slides` accepts `{title, body}` or `{title, document}`. The
document contract is version 2 and contains paragraphs, flat bullet lists,
left/center/right alignment, bold, italic, underline, and relative font sizes
from 60–220% in 10% steps. The server
accepts only this allowlist and derives compatibility `body`; raw HTML and raw
Tiptap JSON are not persistence contracts. GET/PUT/DELETE use
`/api/church/slides/[id]`; PUT accepts `{input: {title, document},
expectedRevision}`, and DELETE accepts `{expectedRevision}`. Create/read/update
return `{slide}` without `churchId`; delete has no response body. Mutation Origin
must exactly match the configured canonical origin. CRUD detail routes reject
query parameters; list cursor parameters belong to the collection read contract.

The text editor uses a conventional toolbar attached to a visibly bounded 16:9
editing panel. Font size uses a select control; inline marks, alignment, bullet
list, undo, and redo use compact icon buttons with accessible names. The panel
remains distinguishable from the black page background and shows an input
placeholder when empty. Heading styles are not offered.

Issue #470 adds multipart create/update for image Slides. The form contains
exactly `title` and `image`, plus `expectedRevision` for update. Accept one
decoded JPEG, PNG, or static WebP upload of at most 10 MiB; decoded dimensions
are at most 8,192 × 8,192 and 40 million pixels. The server applies orientation,
removes metadata, re-encodes, and rejects malformed or animated files. Updating
an image Slide title without replacing its bytes uses JSON with
`contentType: "image"`. Switching to text physically deletes the image child.
Each application process permits two active normalizations and four queued
normalizations; further work fails closed. A normalization request times out
after 30 seconds while its native operation retains its slot until completion.
The authenticated `GET /api/church/slides/[id]/image?revision=N` returns bytes
only for the owned Slide and exact current revision with private no-store
headers. Invalid, missing, stale, and foreign image requests disclose no bytes.

Each production church has an explicit byte quota. Reaching it returns 409 and
does not partially mutate the Slide. The deployment value requires operator
approval; one GiB is only the checked-in development/test example.

## Single-page body and preview

Issue #424 intentionally simplifies the replacement contract: one Slide body is
one projected surface. Normalize EOL, then preserve every newline as body content;
four or more consecutive LFs do not delimit pages. The pinned legacy section above
continues to record Ginmaku's former split behavior as historical evidence, not as
active Levi behavior. Empty or ASCII-whitespace-only bodies remain invalid, and
HTML-like input remains literal text rather than executable markup.

Issue #479 adds WYSIWYG range sizing on this single surface. The author may use
60–220% in 10% steps. Preview, detail, and audience render those relative sizes
with the same fit calculation. Paste retains plain text and LF only. Existing
plain-body rows render as all 100%. The unreleased version 1 document format is
not accepted. The projection controller's 60–220% adjustment remains transient
and multiplies authored sizes.

Preview is an explicit local operation over unsaved body; it neither writes a
Slide nor opens/changes the audience. Title errors do not prevent a valid
body preview. Preview and audience preserve line breaks, use the same text-fit
rules and aspect ratio, and show body only. Slide text uses the Scripture
audience's Helvetica/Arial, normal line height and white text with blue edging.
Its pre-existing base size remains 12% of the 16:9 surface height. The title stays
in the controller.
Preview has no page navigation or page selection controls.
Opening projection requires a successfully saved Slide, not an unsaved draft.

An image Slide preview and audience use the same 16:9 black surface. They retain
the image aspect ratio and show the entire image with `object-fit: contain`; they
do not crop, stretch, paginate, or expose text font controls. One Slide contains
one image. Blank/unblank and revision/session revalidation match text Slides.

## List pagination

Issue #397 removes the body-search and recent-update APIs after their controls
were removed from the product in #412. The collection read now has one behavior:
list Slides by `created_at DESC, id DESC`, 20 rows per page.

Use a cursor for the last tuple and fetch one extra row to determine `hasNext`;
no unbounded response or count is required. UUID is a tiebreaker, never a
chronological ID. The cursor is a bounded strict JSON string with
`{version:1,createdAt,id}`. It is a position, not an authorization token, and
never determines church scope. Unknown, duplicate, `q`, or `mode` parameters are
invalid rather than silently changing to the all-list.

This is a live list, not a snapshot: concurrent creates appear on refresh and
deletes may shorten a later page. With unchanged data, traversal has no
duplicates or omissions. Test equal creation timestamps, cursor tampering, and
cross-tenant cursor reuse. Responses contain `{slides,nextCursor}`; list entries
include the normalized `contentType: "text" | "image"` needed for the visible
type label and omit body, image metadata, image bytes, and church ID.

## Projection

Reuse the [direct audience foundation](projection-window-protocol.md): a
controller and one ordinary same-origin Chrome tab named `projector`, an exact
retained Window reference, validated messages, READY handshake, blocked-tab
feedback, and authenticated reads. Slide routes are `/slides`, `/slides/new`,
`/slides/[id]`, `/slides/[id]/edit` and `/slides/audience`; audience URL contains
only an opaque Slide ID, never content.
APIs are church-scoped under `/api/church/slides`.

The audience displays the complete saved body as one surface and owns font and
blank state. The controller displays acknowledged state and provides Open, font
size and blank controls. It has no previous/next buttons, page count or page
selection. Scripture retains its own coordinate navigation.

Shared presentation state is limited to connection generation, readiness,
sequence, font scale, blank and authorization lifecycle. Slide ID and revision
stay in the slide domain. Scripture canonical
coordinates/navigation stay in scripture. Do not introduce a generic persisted
presentation/JSON model or share church content through localStorage.

A new Open invalidates the previous generation; v1 READY alone cannot identify
which content is ready. The shared-foundation child must introduce a strict,
versioned handshake bound to content kind and connection generation and acknowledged
state. Reject stale generations, wrong
origin/source/kind, unknown fields and out-of-order acknowledgements. Opening
scripture after slides (or vice versa) cannot leave the old controller in charge.
Preserve v1 scripture behavior during the staged rollout and fail closed for
incompatible tab versions, with an explicit reopen instruction.

Close/reopen and reload reauthorize and fetch saved data. Unknown audience query
parameters show a recoverable error. A newer saved revision clears old text and asks to reopen; physical
deletion clears text and shows unavailable. Revalidate the Slide on visibility,
visibility, and the existing 30-second eligibility cycle so an open audience
cannot retain deleted/reassigned content indefinitely. Denied/failed checks
clear text and stop commands; late responses cannot restore it. Immediate remote
revocation is not claimed between checks. Reload resets transient font/blank;
no durable presentation history is added.

## UI and acceptance boundary

The scripture sidebar has a single “スライドの一覧” link to `/slides`, directly
below “フォルダの一覧” with the same appearance. It does not embed slide titles,
creation/search controls, pagination or a slide-list request. Settings contains
account actions only. The existing `/slides` page owns slide listing and
creation. Slide list, create, detail and edit screens all use the shared folder
sidebar available on signed-in church management screens.

The `/slides` page is titled “スライドの一覧”. Per the #412 UI simplification,
show all slides immediately in creation order (newest first), 20 per page, with
prominent titles and full-row detail links. Keep a
clear create link and error retry; show pagination only when needed. Do not
show a list-refresh button, recent/all mode switches or body search controls.
The corresponding search/recent API parameters are unsupported.

Use existing application surfaces and accessible names. List: loading, empty,
error/retry, success and next-page states. Editor: validation,
unsaved preview, saving/disabled, success, conflict, failure with preserved input.
Delete: explicit confirmation naming the synthetic/current title, cancel restores
focus, failure retains context, success returns to the list. Never claim undo.
Controller: not open, blocked, connecting, ready, blank,
disconnected, deleted, stale revision and denied session. Audience: only body,
blank or generic unavailable/recovery feedback, never tenant/account metadata.

Use semantic labels, visible focus, status/error
announcements and non-color-only feedback. Verify controller/editor at 390px and
1280px widths and audience at 1280×720 and 1920×1080; controls must remain usable
without clipping. Test short/long lines and Japanese text for fit and line-break
parity. Use synthetic data and latest project-pinned Chromium; retain the
existing scripture and bookmark E2E suite.

Legacy slide bookmark import remains outside delivery. Issue #420 adds a native
`SlideBookmark` subtype with a typed, church-scoped Slide FK; it never reuses
route JSON. Each row on `/slides` and the detail controller can append the Slide
to the folder selected in the shared sidebar. The server derives the title from
the owned Slide. Mixed
Scripture/Slide bookmarks share ordering and deletion controls; selecting a
Slide bookmark navigates to its detail page in the same tab. Physical Slide
deletion removes its saved references and compacts affected folders.
Songs, PDF, soft delete, history, real legacy imports and production operations
remain excluded. Schema expansion is required, but legacy slide data migration
is not; the migration child records and verifies that distinction.
