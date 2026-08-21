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

- a **platform operator**, who operates Levi and creates churches and their
  initial accounts through a protected administration screen; and
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

The release includes login, logout, email-based self-service password reset,
tenant isolation, Bible data migration, search, projection, and Bible-search
bookmarks and folders.

## Bible catalog and migration

The retained translations are:

| Stable code | Display name             | Language |
| ----------- | ------------------------ | -------- |
| `JSS3`      | 新改訳聖書第3版          | Japanese |
| `KJV`       | King James Version (KJV) | English  |

Translation is first-class master data. A verse is identified by translation,
canonical book, chapter number, and verse number; it must not depend on a legacy
row ID or physical storage order. Canonical books are shared by translations,
while displayed book names may differ by translation.

Only Bible data is migrated from the legacy MySQL dump. Bible text may be read,
stored, migrated, or displayed only after the product owner confirms the
applicable rights and provenance. The dump itself and extracted verse text must
not appear in the repository, Issues, pull requests, prompts, logs, fixtures, or
public CI artifacts.

## Bible search

Search preserves the legacy selection model:

- one canonical book;
- one chapter;
- an inclusive starting and ending verse within that chapter; and
- Japanese, English, or both translations.

The ending verse is required to be at or after the starting verse. Results are
ordered by canonical location. In bilingual mode, the Japanese and English text
for one location form one logical projected item even if their stored records
have unrelated IDs.

Examples:

- `ヨハネ 3:16–18 / 日本語` initially shows three Japanese items.
- `John 3:16–18 / English` initially shows three KJV items.
- `ヨハネ 3:16–18 / 両方` initially shows three paired items, not six
  independently navigable items.

Missing selections, reversed ranges, nonexistent chapters or verses, and a
missing requested translation are explicit validation or data-integrity errors;
they are not silently corrected.

## Projection and navigation

Projection uses two browser windows in one latest-Chrome session:

- the **controller window** contains search results and controls; and
- the **audience window** contains only audience-facing content and display
  state.

The controller provides direct selection of a result, previous and next verse,
larger and smaller text, scroll up and down, and blank/unblank behavior. Its
visible state must make the current reference and whether the audience is
blanked understandable under time pressure.

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

If the audience window is blocked, closed, reloaded, or reopened, the controller
must show the condition and offer a deterministic recovery path. Synchronization
messages must be schema- and origin-validated. Expired authentication must not
leave protected controls usable or expose additional content.

## Folders and bookmarks

A folder and its bookmarks belong to one church. The initial release supports:

- create and rename a folder;
- pin or unpin a frequently used folder;
- show pinned folders first and then recently used folders, up to 20 total;
- update `last used` when a folder is explicitly selected or one of its
  bookmarks is reopened;
- reorder folders and bookmarks deterministically;
- save a typed Bible search consisting of book, chapter, inclusive range, and
  language selection;
- reopen a bookmark into the search and projection flow; and
- physically delete a bookmark or folder after confirmation.

Deleting a folder physically deletes only bookmarks owned by that folder. It
does not delete shared Bible master data. Core bookmark fields must not be stored
as legacy controller/action names or opaque route-parameter JSON.

## Authentication behavior

Login succeeds only for an active church account with a valid password. Login
failure must not reveal whether an email address exists. Logout, expiry,
revocation, account suspension, and password reset invalidate access to protected
routes.

A password-reset request returns the same visible result whether or not the
address exists. A reset link is short-lived and single-use; the database stores
only a hash of its secret token. Successful reset invalidates existing sessions.
The authentication library, session lifetime, reset lifetime, email provider,
and delivery retry policy are selected through
[Issue #40](https://github.com/iwaseasahi/levi/issues/40), not by this product
specification.

## UI state and accessibility requirements

Every interactive screen defines and tests relevant loading, empty, validation
error, server error, success, and disabled states. Controls have programmatic
labels, work by keyboard, expose error messages to assistive technology, and
move focus to a useful location after navigation, validation failure, or dialog
completion. Opening the audience window must not unexpectedly strand keyboard
focus.

Only the latest stable Chrome is guaranteed initially. Responsive behavior must
support the controller and audience window sizes exercised by the release E2E;
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
- a two-window latest-Chrome E2E covering search, projection, controls,
  end-range navigation, chapter-boundary navigation, window recovery, and
  folder/bookmark reuse;
- a Bible import reconciliation report that exposes no verse text or secrets;
- successful backup/restore and migration rehearsals against disposable data;
- every required repository check passing on the exact merge commit; and
- recorded human decisions for content rights and any production operation.
