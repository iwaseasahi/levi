# Post-release slide contract

Delivery: [Issue #59](https://github.com/iwaseasahi/levi/issues/59). This is the
contract for child implementation Issues. The [acceptance map](../testing-slide-e2e.md)
records runtime verification; production rollout is separately approved.
Ownership/storage: [ADR 0015](../architecture/0015-church-owned-slides.md).

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

A Slide belongs to a church, not its author or creator. All members with an
eligible church session can manage that church's slides.

| Field                    | Replacement rule                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `churchId`         | Server-owned UUIDs; church from the authenticated actor only.                                                                                                    |
| `title`                  | Required, trim leading/trailing ASCII space/tab/newline after EOL normalization, 1–200 Unicode code points, single line (no CR/LF/tab).                          |
| `body`                   | Required plain text, normalize CRLF/CR to LF, preserve other whitespace; 1–100,000 Unicode code points and at least one character other than ASCII space/tab/LF. |
| `author`                 | Optional attribution text, not an identity relationship; same trimming/single-line rule as title, at most 200 code points; blank becomes null.                   |
| `revision`               | Server-owned positive integer, starts at 1 and increments on update; optimistic concurrency token, not edit history.                                             |
| `createdAt`, `updatedAt` | Server-owned UTC timestamps; creation time immutable.                                                                                                            |

Reject NUL and malformed Unicode; reject unknown request fields. Count code
points, not UTF-16 units. Reject excessive input without truncation, and bound
JSON request size to 1 MiB before parsing. Required title/body and explicit limits
are intentional Levi validation improvements, not observed legacy restrictions.
These rules do not authorize rewriting or discarding existing legacy content.

Create/update errors retain the user's input. Invalid input is 400, missing or
foreign-tenant IDs have the same 404 response, and stale revision is 409. Update
and delete require the expected revision; they cannot silently overwrite a
concurrent edit. Success is 201 for create, 200 for read/update, 204 for delete.
POST `/api/church/slides` accepts `{title, body, author?}`. GET/PUT/DELETE use
`/api/church/slides/[id]`; PUT accepts `{input: {title, body, author?},
expectedRevision}`, and DELETE accepts `{expectedRevision}`. Create/read/update
return `{slide}` without `churchId`; delete has no response body. Mutation Origin
must exactly match the configured canonical origin. CRUD detail routes reject
query parameters; search/list parameters belong to the collection read contract.

## Page parsing, outline and preview

Use one pure parser for saved projection, unsaved preview and outline. Normalize
EOL first, then split at four **or more LF characters**. Three LFs remain within
a page; spaces between LFs prevent a delimiter. Preserve leading empty pages
and in-page whitespace, but discard trailing empty split elements like Ruby.
A blank outline label is displayed as `Page N`; it does not alter page content.

These are synthetic golden inputs (escape notation denotes actual characters):

| Input body                          | Page strings                                        |
| ----------------------------------- | --------------------------------------------------- |
| `A\r\nB\rC`                         | `["A\nB\nC"]`                                       |
| `A\n\n\nB`                          | `["A\n\n\nB"]`                                      |
| `A\n\n\n\nB` or `A\n\n\n\n\nB`      | `["A", "B"]`                                        |
| `A\r\n\r\n\r\n\r\nB`                | `["A", "B"]`                                        |
| `\n\n\n\nA\n\n\n\n`                 | `["", "A"]`                                         |
| `A\n\n \n\nB`                       | `["A\n\n \n\nB"]`                                   |
| Empty or ASCII-whitespace-only body | Validation error; preview has no projectable pages. |
| `<script>synthetic</script>\nB`     | One literal text page; never executable HTML.       |

Preview is an explicit local operation over unsaved body; it neither writes a
Slide nor opens/changes the audience. Title/author errors do not prevent a valid
body preview. Preview and audience preserve line breaks, use the same text-fit
rules and page aspect ratio, and show body only. Title/author stay in the
controller. Preview labels/page controls are outside the projected content.
Opening projection requires a successfully saved Slide, not an unsaved draft.

## Search, recent and list pagination

- Search only normalized `body`, with one literal substring; title and author
  are not included. Empty query lists all. No tokenization, stemming, HTML,
  wildcard language or regex. Do not trim the query; whitespace is meaningful.
- Normalize query EOL, limit to 200 code points, reject NUL/malformed Unicode.
  Escape SQL LIKE `%`, `_` and the escape character and parameterize values.
- ASCII A–Z matching is case-insensitive; all other code points match literally
  (no kana-width, accent or Unicode normalization). Implement/test this explicit
  fold under a deterministic PostgreSQL collation; do not inherit host locale.
- Recent means the last 10 updates, ordered `updated_at DESC, id DESC`, including
  creates; reading, previewing and projecting never update recency.
- All-list and search use `created_at DESC, id DESC`, 20 rows per page, using a
  cursor for the last tuple. UUID is a tiebreaker, never a chronological ID.
  Fetch one extra row to determine `hasNext`; no unbounded response or count is
  required. Filter/tenant changes discard the cursor; the client retains prior
  cursors for Back. Validate cursor shape and bind it to normalized query;
  always derive tenant from the session, never from the cursor.
- This is a live list, not a snapshot: concurrent creates appear on refresh;
  deletes may shorten a later page; edits can change search membership. With
  unchanged data, traversal has no duplicates or omissions. Test equal creation
  timestamps, literal `%`/`_`/backslash, ASCII case and Japanese exact matching.

Stable ordering, literal wildcard handling and explicit case behavior deliberately
replace the old incidental ID/collation behavior. No production full-text search
service or extension is required; measure tenant-scoped query plans before
adding one.

GET `/api/church/slides` accepts optional `mode=all|recent` (default `all`),
`q` (default empty), and `cursor`. Recent rejects nonempty queries/cursors.
Duplicate or unknown parameters are invalid. Responses contain `{slides,
nextCursor}`; list entries omit body and church ID. Cursor is a bounded strict
JSON string with `{version:1,q,createdAt,id}`, encoded by URLSearchParams in the
request. It is not an authorization token and never determines church scope.
See the [synthetic query-plan baseline](../testing-slide-search-performance.md)
and measured performance follow-up #397.

## Projection and page operation

Reuse the [direct audience foundation](projection-window-protocol.md): a
controller and one ordinary same-origin Chrome tab named `projector`, an exact
retained Window reference, validated messages, READY handshake, blocked-tab
feedback, and authenticated reads. Slide routes are `/slides`, `/slides/new`,
`/slides/[id]`, `/slides/[id]/edit` and `/slides/audience`; audience URL contains
only an opaque Slide ID and zero-based page index, never content or author.
APIs are church-scoped under `/api/church/slides`.

The audience owns current page, font and blank state; the controller displays
acknowledged state, never an optimistic page count. Start at page 0; previous at
0 and next at the last page are no-ops, with disabled controller buttons.
Outline selection validates page bounds. Blank retains page/font; navigation
while blank changes the page shown after unblank. ArrowUp/Down use the same
path as buttons. Do not steal keys from the slide editor's inputs, textarea,
contenteditable, IME composition or modified shortcuts.

Shared presentation state is limited to connection generation, readiness,
sequence, font scale, blank and authorization lifecycle. Slide ID, revision,
page array/index and outline stay in the slide domain. Scripture canonical
coordinates/navigation stay in scripture. Do not introduce a generic persisted
presentation/JSON model or share church content through localStorage.

A new Open invalidates the previous generation; v1 READY alone cannot identify
which content is ready. The shared-foundation child must introduce a strict,
versioned handshake bound to content kind and connection generation, acknowledged
state and bounded page-selection commands. Reject stale generations, wrong
origin/source/kind, unknown fields and out-of-order acknowledgements. Opening
scripture after slides (or vice versa) cannot leave the old controller in charge.
Preserve v1 scripture behavior during the staged rollout and fail closed for
incompatible tab versions, with an explicit reopen instruction.

Close/reopen and reload reauthorize and fetch saved data; a valid page URL resumes
that page. An invalid/out-of-range URL shows a recoverable error, not a silently
clamped page. A newer saved revision clears old text and asks to reopen; physical
deletion clears text and shows unavailable. Revalidate the Slide on navigation,
visibility, and the existing 30-second eligibility cycle so an open audience
cannot retain deleted/reassigned content indefinitely. Denied/failed checks
clear text and stop commands; late responses cannot restore it. Immediate remote
revocation is not claimed between checks. Reload resets transient font/blank;
no durable presentation history is added.

## UI and acceptance boundary

The scripture sidebar has a single “スライドの一覧” link to `/slides`, directly
below “フォルダの一覧” with the same appearance. It does not embed slide titles,
creation/search controls, pagination or a slide-list request. Settings contains
account actions only. The existing `/slides` page owns slide listing and creation.

The `/slides` page is titled “スライドの一覧”. Per the #412 UI simplification,
show all slides immediately in creation order (newest first), 20 per page, with
prominent titles, optional author attribution and full-row detail links. Keep a
clear create link and refresh/retry; show pagination only when needed. Do not
show recent/all mode switches or body search controls. The search/recent API
contract above remains supported and tested for compatibility.

Use existing application surfaces and accessible names. List: loading, empty,
error/retry, success and next-page states. Editor: validation,
unsaved preview, saving/disabled, success, conflict, failure with preserved input.
Delete: explicit confirmation naming the synthetic/current title, cancel restores
focus, failure retains context, success returns to the list. Never claim undo.
Controller: not open, blocked, connecting, ready, blank, first/last page,
disconnected, deleted, stale revision and denied session. Audience: only body,
blank or generic unavailable/recovery feedback, never tenant/account metadata.

Use semantic labels, visible focus, keyboard page/outline controls, status/error
announcements and non-color-only feedback. Verify controller/editor at 390px and
1280px widths and audience at 1280×720 and 1920×1080; controls must remain usable
without clipping. Test short/long lines and Japanese text for fit and line-break
parity. Use synthetic data and latest project-pinned Chromium; retain the
existing scripture and bookmark E2E suite.

Legacy slide bookmarks are outside this first slide delivery: the parent
excludes importing them and #59 does not request a new bookmark subtype. Adding
slide bookmarks requires its own typed FK contract; never reuse route JSON.
Songs, PDF, soft delete, history, real legacy imports and production operations
remain excluded. Schema expansion is required, but legacy slide data migration
is not; the migration child records and verifies that distinction.
