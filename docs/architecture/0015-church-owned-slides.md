# ADR 0015: Keep slides church-owned and presentation transient

- Status: accepted
- Date: 2026-08-31
- Scope: implementation contract for Issue #59's children; no schema deployed yet
- Extends: [ADR 0007](0007-normalized-data-model.md)

## Context

#38/#59 require slides after the first release, physical deletion, no edit
history, and reuse of the controller/audience foundation. Ginmaku has nullable
unscoped fields and soft deletion. The
[slide contract](../product/slide-contract.md) pins that source and defines the
replacement validation, paging, search, preview and projection behavior.

## Post-release projection re-evaluation

Re-evaluated before decomposing implementation on 2026-08-31:

- #57 and #58 are closed. The
  [2026-08-26 production workflow record](https://github.com/iwaseasahi/levi/issues/279#issuecomment-5419668591)
  reports separate-tab Japanese/English/bilingual projection, button navigation
  and blank/unblank. It explicitly distinguishes component-tested keyboard
  navigation from live button measurements. No new production access was used.
- Current Levi baseline is `7732f035517bb1b9f98b982026639b7d4ecafa6a`.
  `src/domain/projection/direct-audience-control.ts` validates v1 READY/CONTROL
  envelopes with exact source/origin checks. `use-direct-audience-controller.ts`
  keeps a Window reference, and the audience owns display/navigation state.
- Later Issue #370 adds controller keyboard navigation. Its global key handler
  must not be copied into a slide editor where Up/Down moves the text cursor.
- V1 has no content kind, generation, page-selection command or acknowledged
  current-page state. Reusing the same named tab across two content types would
  make a source/origin-only READY insufficient to bind it to the right content.
- [Issue #302](https://github.com/iwaseasahi/levi/issues/302) is still open:
  Sunday traffic/capacity/latency evidence is unavailable. Neither source review
  nor the initial smoke record establishes live congregation load or latency.

Conclusion: retain the measured same-origin direct-tab topology and
fail-closed lifecycle. Extract transport/state handling with scripture regression
coverage before adding slides; version the handshake and state acknowledgements
as described in the product contract. Do not revive fixed-timeout function calls,
introduce a WebSocket service, or assume the current scripture hook is already a
generic presentation API. Revisit capacity separately when #302 has evidence;
a measured projection blocker must stop the affected implementation child.

## Slide aggregate and physical contract

Use a dedicated Prisma `Slide` mapped to `slides`, with no generic payload table,
page table, author identity FK, deletion marker, history table or history trigger.
Pages are deterministically derived from body. Normalization and limits are in
the product contract and must agree in application and database tests.

| Column                     | Storage / invariant                                                  |
| -------------------------- | -------------------------------------------------------------------- |
| `id`                       | UUID primary key, server generated                                   |
| `church_id`                | UUID NOT NULL; `slides_church_id_fkey` to `churches(id)`             |
| `title`                    | varchar(200) NOT NULL; normalized nonempty single-line text          |
| `body`                     | text NOT NULL; LF-normalized, 1–100,000 code points, nonblank        |
| `author`                   | varchar(200) NULL; normalized nonempty single-line text when present |
| `revision`                 | integer NOT NULL DEFAULT 1; positive, increment on update            |
| `created_at`, `updated_at` | timestamptz(3) NOT NULL; server-owned UTC                            |

Named SQL CHECKs: `slides_title_valid`, `slides_body_valid`,
`slides_author_valid`, `slides_revision_positive`. Use `char_length` for code
point bounds, exact ASCII trimming as specified, and explicit CR/LF/tab checks
for single-line fields. PostgreSQL rejects NUL; application rejects it before
persistence. Missing/blank author is null, not a sentinel. Duplicate titles in
one church are allowed. No uniqueness on author/title/body is justified.

Indexes:

- `slides_church_created_id_idx (church_id, created_at DESC, id DESC)` for the
  stable keyset all-list/search order;
- `slides_church_updated_id_idx (church_id, updated_at DESC, id DESC)` for recent
  updates; and
- the UUID primary-key index for detail/update/delete alongside a church
  predicate. The tenant-leading list indexes also cover FK lookup.

Body substring search filters after church scope. B-tree is not a claim of
substring acceleration; record EXPLAIN on representative synthetic tenant sizes
in the search child before considering a dedicated search index/extension.

Every repository operation requires server-derived church ID, even for a valid
UUID or cursor. Conditional update/delete uses `(id, church_id, revision)`;
update atomically increments revision. No matching owned row is 404; an owned
row with a changed revision is 409. Resolve this distinction transactionally
without exposing whether another tenant owns an ID. Do not log fields/query.

## Deletion, membership and backups

Deleting a Slide removes that row physically; it does not delete its Church,
users, folders, bookmarks or shared Bible data. User deletion must not delete
slides: `author` is attribution, not ownership. Church deletion cascades to its
Slides through the named FK, an explicit aggregate-ownership exception to the
restrictive default, matching the existing administrative church-deletion flow.
Integration tests must prove both deletion scopes, transaction rollback and
concurrent create/church-delete safety before shipping the FK.

Physical deletion does not instantly purge encrypted backups or browser memory.
Keep existing backup retention; restrict restore to the approved runbook and
reconcile deletes before promotion so a restore does not silently resurrect
content. The migration/recovery child must extend the restore checklist and
synthetic rehearsal. Audience content is cleared on the bounded revalidation
cycle described in the product contract; no durable client content cache.

## Migration and compatibility

A new forward-only schema expansion is required. Existing Bible, folder and
bookmark rows and types remain untouched. Legacy Slide import/backfill is not
required and is excluded by #38. Migration assessment must explicitly record
this difference and prove existing importer scope is unchanged. Never profile
real slide data to justify validation limits.

Deploy schema before the application child that reads it. Rolling the application
back leaves the unused Slide table intact; do not drop populated tables as a
rollback. Production migration/deploy, data import or backup promotion still
requires the specific governance approval. No new provider or production
dependency is selected here.

## Alternatives and consequences

- Copying soft delete/history contradicts confirmed retention scope.
- Persisting page arrays or presentation JSON duplicates derivable data and
  mixes session/window state with church content.
- Reusing scripture search coordinates for slides weakens both domain types.
- Extending v1 messages without content/generation binding permits stale window
  control; the shared-foundation change needs a focused compatibility review.
- Revision is a concurrency token only; keeping it does not create edit history.
- Revisit this ADR for approved slide bookmarks, import, durable presentation,
  collaboration, retention changes or measured search/transport problems.

## 2026-09-01 amendment: typed folder bookmarks

Issue #420 approves Slide favorites as a second, explicit `Bookmark` subtype.
`SlideBookmark` stores an opaque Slide FK and church ID; composite foreign keys
require its parent Bookmark, destination Folder and Slide to share one church.
The deferred total-subtype constraint requires exactly one `ScriptureBookmark`
or `SlideBookmark`, so route JSON and generic payloads remain prohibited.

The server derives the saved title from the owned Slide. Deleting a Slide also
deletes its Bookmark parents and compacts each affected folder in the same
transaction. Folder and church deletion retain their existing cascades. This is
a forward schema expansion with no legacy import or production operation.
