# Initial replacement release specification

## Decision record

- Product owner confirmation: 2026-08-21
- Delivery epic: [Issue #38](https://github.com/iwaseasahi/levi/issues/38)
- Legacy evidence: Ginmaku commit
  [`4b18adb`](https://github.com/iwaseasahi/ginmaku/tree/4b18adb02ac8011630c76137c60038e168f05534)
- Supported browser: the latest stable Google Chrome at release time

This specification replaces the source-derived first-slice recommendation. It
defines product behavior, not permission to use or publish Bible content or to
operate on production systems.

## Users and ownership

Levi serves multiple churches. Each church is a tenant whose prepared content
must be isolated from every other church.

The initial release has two identity types:

- a **platform operator**, who uses one HTTPS Basic-authenticated administration
  credential to create churches and their initial accounts; and
- a **church user**, who signs in with an email address and password and can use
  only that church's data.

Initially, exactly one church user belongs to exactly one church. There are no
roles or permissions inside a church. The data model must keep identity,
membership, and church-owned data separate so a later multiple-user change does
not require replacing identities or re-owning every record.

## Initial release scope

The first complete operator flow is:

1. A platform operator creates a church and its initial account.
2. The church user signs in with an email address and password.
3. The user selects a Bible book, chapter, verse range, and display language.
4. Levi shows the selected verses and opens or reuses a separate audience
   window.
5. The user moves through verses and controls the audience display.
6. The user may save and reopen the search through folders and bookmarks.

The release includes login, logout, platform-operator-managed password reset,
tenant isolation, Bible data migration, search, projection, and Bible-search
bookmarks and folders. It does not require an outbound email service.

## Bible catalog and migration

The retained translations are:

| Stable code | Display name                  | Language |
| ----------- | ----------------------------- | -------- |
| `JSS3`      | 新改訳聖書第3版               | Japanese |
| `NKJV`      | New King James Version (NKJV) | English  |

Translation is first-class master data. A verse is identified by translation,
canonical book, chapter number, and verse number; it must not depend on a legacy
row ID or physical storage order. Canonical books are shared by translations,
while displayed book names may differ by translation.

Only Bible data is migrated from the legacy MySQL dump. Bible text may be read,
stored, migrated, or displayed only after the product owner confirms the
applicable rights and provenance. The dump itself and text extracted from
production must not appear in the repository, Issues, pull requests, prompts,
logs, fixtures, or public CI artifacts. On 2026-08-21, the product owner
explicitly approved using small, reviewed Bible passages in tests. Such fixtures
must come from documented non-production published sources, stay limited to the
verses needed for an observable test, and must not be copied from the production
dump.

## Bible search

Search preserves the legacy selection model:

- one canonical book;
- one chapter;
- an inclusive starting and ending verse within that chapter; and
- Japanese, English, or both translations.

The ending verse, when entered, is required to be at or after the starting
verse. It may be omitted in the search form; Levi then normalizes the inclusive
range to the last contiguous verse in the selected chapter, matching the
retained Ginmaku behavior while preserving a concrete ending verse for
projection and bookmarks. Results are ordered by canonical location. In
bilingual mode, the Japanese and English text for one location form one logical
projected item even if their stored records have unrelated IDs.

Examples:

- `ヨハネ 3:16–18 / 日本語` initially shows three Japanese items.
- `John 3:16–18 / English` initially shows three NKJV items.
- `ヨハネ 3:16–18 / 両方` initially shows three paired items, not six
  independently navigable items.

Missing book, chapter, or starting verse selections, reversed ranges,
nonexistent chapters or verses, and a missing requested translation are
explicit validation or data-integrity errors; they are not silently corrected.

## Projection and navigation

Projection uses two browser windows in one latest-Chrome session:

- the **search window** at `/scripture` retains the Ginmaku-compatible search
  form; and
- the **audience window** opens directly from `Open` and contains only
  audience-facing scripture and display state at `/scripture/audience`.

Selecting a bookmark restores its saved book, chapter, range, and language into
the search window. It does not open the audience window; the user confirms the
restored condition and selects `Open` to project it.

The former `/scripture/controller`, `/church`, `/church/audience`, and
`/church/projection` screen routes do not exist and are not redirect aliases.
Church membership remains an authorization and data-scope concept rather than
a public screen namespace.

There is no intermediate projection-controller screen in this primary flow.
The audience provides the Ginmaku keyboard behavior: `ArrowUp` moves to the
previous canonical verse and `ArrowDown` moves to the next one. The heading
shows translation, book, chapter, and current verse. The retained search screen
also provides Ginmaku's text larger/smaller and scroll up/down controls. Scroll
up/down means previous/next scripture in the legacy behavior; both buttons use
the same canonical navigation as the audience keys. Ginmaku's `空白⇔表示`
control toggles the audience between the existing black surface and the latest
scripture without losing navigation or font state.

The search range chooses the initial result set; it is not a navigation fence.
For example, after searching `ヨハネ 3:16–18`, pressing next on `3:18` moves to
`3:19`. Pressing next on the final verse of chapter 3 moves to the first existing
verse of chapter 4; previous performs the inverse operation. Navigation follows
canonical location and existing verses, not a result-array index or legacy ID.

Crossing from the last chapter of one book to the first chapter of the next book,
and the inverse, is a `should` requirement. It is implemented in
[Issue #53](https://github.com/iwaseasahi/levi/issues/53). It may be deferred only
when measured complexity materially threatens the initial release and the
product owner approves the reason, impact, and follow-up Issue.

If the audience tab is blocked, the search screen reports the condition. If it
is closed, `Open` deterministically creates it again; if it remains open, the
named `projector` target is reused. Reload uses the canonical audience URL.
Expired authentication must immediately fail closed and remove protected text.

## Folders and bookmarks

A folder and its bookmarks belong to one church. The initial release supports:

- create and rename a folder;
- show folders as Ginmaku-style accordion headers, open only one folder at a
  time, and close it by selecting the same header again; the initial/current
  folder is open and contains only its saved scripture links;
- toggle Ginmaku's date plus meeting-name creation form from the
  `新規フォルダ作成` action and open the newly created folder;
- pin or unpin a frequently used folder;
- show pinned folders first and then recently used folders, up to 20 total;
- update `last used` when a folder or one of its bookmarks is selected;
- reorder folders deterministically at the data boundary and reorder bookmarks
  within their folder by drag-and-drop, with Alt+ArrowUp/Alt+ArrowDown as the
  non-visual keyboard fallback;
- open the current folder editor in the same tab for rename, pin, physical
  folder/bookmark deletion, and bookmark ordering;
- save a typed Bible search from Ginmaku's `お気に入りに追加` action immediately
  after the search form; an omitted ending verse remains absent and its title is
  derived as `日本語書巻名/English book chapter:start`, while an explicit range
  uses `日本語書巻名/English book chapter:start-end`;
- restore a bookmark into the search form without opening an audience tab, then
  project it only after `Open`; and
- physically delete a bookmark or folder after confirmation.

Deleting a folder physically deletes only bookmarks owned by that folder. It
does not delete shared Bible master data. Core bookmark fields must not be stored
as legacy controller/action names or opaque route-parameter JSON.

## Authentication behavior

The single platform operator enters `/admin/churches` using browser Basic
authentication. That credential does not create a Better Auth login session and
cannot be used on `/login`. Church users use Better Auth email/password login as
described below. Adding another platform operator requires replacing the shared
credential with individually attributable accounts.

Login succeeds only for an active church account with a valid password. Login
failure must not reveal whether an email address exists. Logout, expiry,
revocation, account suspension, and password reset invalidate access to protected
routes.

An ordinary authenticated session remains valid for 30 days after its last
eligible refresh and refreshes at most once per day. Logout, platform-operator
reset, account suspension, and explicit revocation take effect immediately even
within that period.

A church user cannot request an email reset. A platform operator resets the
account from the protected administration UI. Reset revokes all existing
sessions, issues a generated one-time temporary password that is displayed only
once to the platform operator, and requires the church user to choose a new
password at the next login. Until that change succeeds, the user may access only
the password-change and logout operations. The temporary password is never
stored or logged in plaintext, and Levi does not transmit it by email; the
platform operator communicates it through an approved out-of-band method.

The authentication library, session lifetime, administrator reset behavior, and
temporary-password safeguards are selected through
[Issue #40](https://github.com/iwaseasahi/levi/issues/40).

## UI state and accessibility requirements

All Levi application routes use the scripture-search screen's black-first
visual language: black page backgrounds, black-to-dark-gray content surfaces,
white primary text, muted light-gray supporting text, gray borders, and orange
focus and selection accents. Error and success messages use dark tinted
surfaces with high-contrast text. Ginmaku-compatible search controls and
audience typography retain their scoped legacy appearance within this shared
palette.

Every interactive screen defines and tests relevant loading, empty, validation
error, server error, success, and disabled states. Controls have programmatic
labels, work by keyboard, expose error messages to assistive technology, and
move focus to a useful location after navigation, validation failure, or dialog
completion. Opening the audience window must not unexpectedly strand keyboard
focus.

Only the latest stable Chrome is guaranteed initially. Responsive behavior must
support the search and audience window sizes exercised by the release E2E;
other browsers and offline operation are not compatibility claims.

## Initial-release exclusions and later work

- Praise songs and song PDFs are excluded. Songs may be reconsidered later.
- Message slides are excluded from the initial release but are mandatory later
  work under [Issue #59](https://github.com/iwaseasahi/levi/issues/59). Slides
  will use physical deletion and will not retain edit history.
- Church-internal multiple accounts, invitations, roles, and permissions are
  excluded.
- Legacy song, slide, bookmark, folder, and PDF data are not migrated.
- Full offline operation and compatibility guarantees for browsers other than
  latest Chrome are excluded.
- Production deployment and production migration are external operations that
  require explicit approval immediately before execution.

## Release acceptance evidence

Initial replacement readiness requires all of the following:

- database constraint and tenant-isolation integration tests;
- deterministic synthetic search and navigation golden cases;
- a two-window latest-Chrome E2E covering search, direct audience opening,
  end-range navigation, chapter-boundary navigation, tab recovery, and
  folder/bookmark reuse;
- a Bible import reconciliation report that exposes no verse text or secrets;
- successful backup/restore and migration rehearsals against disposable data;
- every required repository check passing on the exact merge commit; and
- recorded human decisions for content rights and any production operation.
