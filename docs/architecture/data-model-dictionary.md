# Levi data model dictionary

This document is the physical companion to
[ADR 0007](0007-normalized-data-model.md). Keep Better Auth-facing Prisma model
and field names (`User.email`, `Session.userId`, and so on); database tables and
columns use the snake-case names below through `@@map` and `@map`. Better Auth
uses `advanced.database.generateId: "uuid"` for every core model.

`PK`, `UK`, `FK`, and `CK` mean primary key, unique constraint, foreign key, and
CHECK constraint. Every timestamp is `timestamptz(3)` in UTC. Every mutable table
has `created_at` and `updated_at`; insert sets both to `now()` and application
writes update `updated_at`.

## Database enums

| Enum                  | Values                | Owner/use                     |
| --------------------- | --------------------- | ----------------------------- |
| `user_actor_state`    | `PENDING`, `ACTIVE`   | safe identity provisioning    |
| `church_status`       | `ACTIVE`, `SUSPENDED` | tenant access lifecycle       |
| `bible_rights_status` | `PENDING`, `APPROVED` | content import/display gate   |
| `bible_testament`     | `OLD`, `NEW`          | canonical book classification |

Enums are mapped to explicit Prisma enums and physical values. Adding or
renaming a value requires a forward migration and compatibility review.

## Identity and tenancy columns

### `users` — Better Auth identity plus Levi lifecycle

| Column                 | Type           | Null | Default             | Contract                                                                |
| ---------------------- | -------------- | ---- | ------------------- | ----------------------------------------------------------------------- |
| `id`                   | `uuid`         | no   | `gen_random_uuid()` | PK; Better Auth User ID                                                 |
| `name`                 | `varchar(200)` | no   | —                   | Better Auth required display name                                       |
| `email`                | `citext`       | no   | —                   | globally unique normalized login identifier                             |
| `email_verified`       | `boolean`      | no   | `false`             | Better Auth required; no initial email-verification workflow            |
| `image`                | `text`         | yes  | —                   | optional Better Auth image URL; unused initially                        |
| `actor_state`          | enum           | no   | `PENDING`           | `PENDING` or `ACTIVE`; server-owned, never accepted from auth API input |
| `must_change_password` | `boolean`      | no   | `false`             | server-owned forced-change gate; omitted from public auth response      |
| `created_at`           | `timestamptz`  | no   | `now()`             | Better Auth required                                                    |
| `updated_at`           | `timestamptz`  | no   | `now()`             | Better Auth required                                                    |

Constraints:

- `users_email_uk`: unique B-tree on `email` using `citext` semantics.
- `users_email_normalized_ck`:
  `email::text = lower(btrim(email::text)) AND length(email::text) <= 320`.
- `users_name_nonblank_ck`: `length(btrim(name)) > 0`.
- Deferred actor constraint: `ACTIVE` requires exactly one row across
  `platform_operators` and `church_memberships`; `PENDING` requires neither.

Better Auth configuration maps logical `user` fields to this table and declares
`actorState` and `mustChangePassword` as additional fields with `input: false`.

### `accounts` — Better Auth credential account

| Column                     | Type           | Null | Contract                                       |
| -------------------------- | -------------- | ---- | ---------------------------------------------- |
| `id`                       | `uuid`         | no   | PK                                             |
| `user_id`                  | `uuid`         | no   | FK to `users.id`                               |
| `account_id`               | `varchar(255)` | no   | Better Auth credential account ID              |
| `provider_id`              | `varchar(64)`  | no   | initially exactly `credential`                 |
| `issuer`                   | `varchar(255)` | no   | initially exactly `local:credential`           |
| `access_token`             | `text`         | yes  | Better Auth core OAuth field; must remain null |
| `refresh_token`            | `text`         | yes  | Better Auth core OAuth field; must remain null |
| `access_token_expires_at`  | `timestamptz`  | yes  | Better Auth core OAuth field; must remain null |
| `refresh_token_expires_at` | `timestamptz`  | yes  | Better Auth core OAuth field; must remain null |
| `scope`                    | `text`         | yes  | Better Auth core OAuth field; must remain null |
| `id_token`                 | `text`         | yes  | Better Auth core OAuth field; must remain null |
| `password`                 | `text`         | yes  | encoded Better Auth `scrypt` hash; Restricted  |
| `created_at`               | `timestamptz`  | no   | Better Auth required                           |
| `updated_at`               | `timestamptz`  | no   | Better Auth required                           |

Constraints and indexes:

- `accounts_user_fk`: `user_id -> users.id ON DELETE CASCADE`.
- `accounts_issuer_account_uk`: unique `(issuer, account_id)` for Better Auth
  1.7 account identity lookup.
- `accounts_user_provider_uk`: unique `(user_id, provider_id)`; one credential
  account per User.
- `accounts_credential_only_ck`: provider is `credential`, issuer is
  `local:credential`, `account_id` equals `user_id::text`, password is non-null,
  and every OAuth token/scope/expiry field is null.
- `accounts_password_hash_format_ck`: password matches Better Auth 1.7.1's
  default encoded scrypt shape, 16-byte lowercase-hex salt, a colon, and a
  64-byte lowercase-hex derived key. Dependency upgrades must review this
  compatibility check before changing the hash implementation.

`password` remains nullable in the Prisma mapping because Better Auth's core
adapter contract marks it optional; the database CHECK makes it mandatory for
the only permitted initial provider. Password hashes never share a column with
session or verification values.

### `sessions` — Better Auth revocable session

| Column       | Type           | Null | Contract                                      |
| ------------ | -------------- | ---- | --------------------------------------------- |
| `id`         | `uuid`         | no   | PK                                            |
| `user_id`    | `uuid`         | no   | FK to `users.id`                              |
| `token`      | `varchar(255)` | no   | unique opaque lookup token; Restricted        |
| `expires_at` | `timestamptz`  | no   | 30-day rolling expiry                         |
| `ip_address` | `inet`         | yes  | request address when collection is configured |
| `user_agent` | `text`         | yes  | request user agent                            |
| `created_at` | `timestamptz`  | no   | Better Auth required                          |
| `updated_at` | `timestamptz`  | no   | last eligible rolling update                  |

Constraints and indexes:

- `sessions_user_fk`: `user_id -> users.id ON DELETE CASCADE`.
- `sessions_token_uk`: unique token lookup.
- `sessions_user_expires_idx`: `(user_id, expires_at DESC)` for list/revoke.
- `sessions_expires_idx`: `(expires_at)` for bounded expiry cleanup.
- `sessions_expiry_order_ck`: `expires_at > created_at`.

The DB does not embed the current clock in a CHECK. Application/session tests
enforce the configured 30-day lifetime and daily update age.

### `verifications` — Better Auth reserved verification storage

| Column       | Type           | Null | Contract                                 |
| ------------ | -------------- | ---- | ---------------------------------------- |
| `id`         | `uuid`         | no   | PK                                       |
| `identifier` | `varchar(255)` | no   | Better Auth verification lookup          |
| `value`      | `text`         | no   | dedicated verification value; Restricted |
| `expires_at` | `timestamptz`  | no   | expiry                                   |
| `created_at` | `timestamptz`  | no   | Better Auth required                     |
| `updated_at` | `timestamptz`  | no   | Better Auth required                     |

Indexes: `verifications_identifier_idx` on `identifier` and
`verifications_expires_idx` on `expires_at`. The initial configuration has no
email verification/reset workflow and must leave this table unused. It remains
separate so a future approved library workflow cannot mix its values with
password hashes or session tokens.

### `rate_limits` — Better Auth shared abuse-prevention counters

| Column         | Type           | Null | Contract                                     |
| -------------- | -------------- | ---- | -------------------------------------------- |
| `id`           | `uuid`         | no   | PK; Better Auth generated ID                 |
| `key`          | `varchar(255)` | no   | unique Better Auth limiter bucket key        |
| `count`        | `integer`      | no   | non-negative request count                   |
| `last_request` | `bigint`       | no   | non-negative Better Auth request time marker |

Constraints and indexes:

- `rate_limits_key_uk`: unique bucket lookup.
- `rate_limits_count_ck`: `count >= 0`.
- `rate_limits_last_request_ck`: `last_request >= 0`.
- `rate_limits_last_request_idx`: expiry/cleanup scan by oldest marker.

The table contains no password, session token, verification value, IP address,
or email address. Better Auth owns the key format; application code must not
parse it as an authorization or tenant identifier.

### `churches`

| Column         | Type           | Null | Default   | Contract                     |
| -------------- | -------------- | ---- | --------- | ---------------------------- |
| `id`           | `uuid`         | no   | generated | PK                           |
| `name`         | `varchar(200)` | no   | —         | operator-facing church name  |
| `status`       | enum           | no   | `ACTIVE`  | `ACTIVE` or `SUSPENDED`      |
| `suspended_at` | `timestamptz`  | yes  | —         | when status became suspended |
| timestamps     | `timestamptz`  | no   | `now()`   | creation/update              |

Constraints:

- `churches_name_nonblank_ck`: trimmed name is nonblank.
- `churches_suspension_ck`: `ACTIVE` has null `suspended_at`; `SUSPENDED` has a
  non-null `suspended_at`.

No unique church-name rule is imposed; distinct churches may share a name.

### `platform_operators`

| Column       | Type          | Null | Contract                                  |
| ------------ | ------------- | ---- | ----------------------------------------- |
| `user_id`    | `uuid`        | no   | PK and FK to `users.id ON DELETE CASCADE` |
| `created_at` | `timestamptz` | no   | assignment time                           |

The initial seed creates exactly one deterministic internal platform operator.
It has no `accounts` row and therefore cannot authenticate through Better Auth.
Successful administration Basic authentication is mapped to this actor only so
existing provisioning, reset, and audit authorization continues to use an
explicit database identity.

### `church_memberships`

| Column       | Type          | Null | Contract                              |
| ------------ | ------------- | ---- | ------------------------------------- |
| `id`         | `uuid`        | no   | PK                                    |
| `church_id`  | `uuid`        | no   | FK to `churches.id ON DELETE CASCADE` |
| `user_id`    | `uuid`        | no   | FK to `users.id ON DELETE CASCADE`    |
| `created_at` | `timestamptz` | no   | assignment time                       |

`church_memberships_church_uk` and `church_memberships_user_uk` enforce the
initial one-to-one relationship. The first constraint is the only cardinality
constraint removed when multiple users per church is approved.

`actor_assignment_ck` is implemented as deferred constraint triggers on User,
PlatformOperator, and ChurchMembership changes. The trigger locks the User row
before counting assignments, which makes concurrent inserts serialize. Updates
validate both the old and new User IDs so subtype reassignment cannot orphan the
source User. It rejects dual subtype rows, active unassigned users, and pending
assigned users. On cascade deletion it returns successfully when the User row no
longer exists.

## Shared Bible catalog columns

### `bible_translations`

| Column             | Type           | Null | Contract                             |
| ------------------ | -------------- | ---- | ------------------------------------ |
| `id`               | `uuid`         | no   | PK                                   |
| `code`             | `varchar(16)`  | no   | stable UK: initially `JSS3`, `NKJV`  |
| `name`             | `varchar(200)` | no   | displayed translation name           |
| `language_tag`     | `varchar(35)`  | no   | initial BCP 47 tags `ja` and `en`    |
| `display_order`    | `smallint`     | no   | positive UK                          |
| `rights_status`    | enum           | no   | `PENDING` or `APPROVED`              |
| `source_reference` | `text`         | yes  | approved provenance reference        |
| `rights_notice`    | `text`         | yes  | approved use/attribution constraints |
| timestamps         | `timestamptz`  | no   | creation/update                      |

Checks require nonblank name, code matching `^[A-Z0-9][A-Z0-9_-]{0,15}$`, a
lowercase basic language tag, and positive display order.
`bible_translations_rights_ck` permits draft references while pending and
requires both to be nonblank while approved. Import/search use cases require
`APPROVED`; the repository never stores secret contract documents in these
fields.

### `bible_books`

| Column            | Type          | Null | Contract                           |
| ----------------- | ------------- | ---- | ---------------------------------- |
| `id`              | `uuid`        | no   | PK                                 |
| `canonical_code`  | `varchar(16)` | no   | uppercase stable UK                |
| `canonical_order` | `smallint`    | no   | positive UK across the whole Bible |
| `testament`       | enum          | no   | `OLD` or `NEW`                     |
| `created_at`      | `timestamptz` | no   | creation                           |

Checks require the same uppercase-code form and positive canonical order. Do not
store chapter counts inferred from the legacy dump; existing verse locations are
the navigation source of truth.

### `bible_book_names`

| Column           | Type           | Null | Contract                                  |
| ---------------- | -------------- | ---- | ----------------------------------------- |
| `id`             | `uuid`         | no   | PK                                        |
| `translation_id` | `uuid`         | no   | FK to translation `ON DELETE RESTRICT`    |
| `book_id`        | `uuid`         | no   | FK to canonical book `ON DELETE RESTRICT` |
| `name`           | `varchar(100)` | no   | displayed full name                       |
| `short_name`     | `varchar(40)`  | yes  | optional approved abbreviation            |

Constraints: unique `(translation_id, book_id)`, unique
`(translation_id, name)`, and nonblank names. Nullable `short_name` means an
approved abbreviation is genuinely absent; empty strings are rejected.

### `bible_verses`

| Column           | Type          | Null | Contract                                      |
| ---------------- | ------------- | ---- | --------------------------------------------- |
| `id`             | `uuid`        | no   | PK                                            |
| `translation_id` | `uuid`        | no   | FK to translation `ON DELETE RESTRICT`        |
| `book_id`        | `uuid`        | no   | FK to canonical book `ON DELETE RESTRICT`     |
| `chapter_number` | `smallint`    | no   | positive                                      |
| `verse_number`   | `smallint`    | no   | non-negative; source includes verse 0         |
| `text`           | `text`        | no   | scripture text; Confidential licensed content |
| `created_at`     | `timestamptz` | no   | import time                                   |

Constraints and indexes:

- `bible_verses_location_uk`: unique
  `(translation_id, book_id, chapter_number, verse_number)`.
- `bible_verses_numbers_ck`: chapter is positive and verse is non-negative.
- `bible_verses_navigation_idx`:
  `(book_id, chapter_number, verse_number, translation_id)` for paired display
  and canonical next/previous lookup.

`text` is NOT NULL, but Issue #46 must not add a nonblank CHECK. Issue #47 profiles
the approved dump without exposing text; if zero trimmed-empty rows are proven,
the contract phase adds `bible_verses_text_nonblank_ck`. Otherwise the product
owner/content owner must approve an explicit repair or missing-content model.

## Church-owned preparation columns

### `folders`

| Column         | Type           | Null | Default   | Contract                                |
| -------------- | -------------- | ---- | --------- | --------------------------------------- |
| `id`           | `uuid`         | no   | generated | PK                                      |
| `church_id`    | `uuid`         | no   | —         | FK to Church `ON DELETE CASCADE`        |
| `name`         | `varchar(200)` | no   | —         | nonblank                                |
| `is_pinned`    | `boolean`      | no   | `false`   | pinned group                            |
| `position`     | `integer`      | no   | —         | zero-based deterministic order          |
| `last_used_at` | `timestamptz`  | yes  | —         | null until explicitly selected/reopened |
| timestamps     | `timestamptz`  | no   | `now()`   | creation/update                         |

Constraints and indexes:

- `folders_id_church_uk`: unique `(id, church_id)` for composite ownership FKs.
- `folders_church_position_uk`: deferrable unique `(church_id, position)`.
- `folders_position_ck`: `position >= 0`.
- `folders_pinned_idx`: `(church_id, is_pinned DESC, position, id)`.
- `folders_recent_idx`: raw index
  `(church_id, last_used_at DESC NULLS LAST, position, id)`.

### `bookmarks`

| Column      | Type           | Null | Contract                       |
| ----------- | -------------- | ---- | ------------------------------ |
| `id`        | `uuid`         | no   | PK                             |
| `church_id` | `uuid`         | no   | tenant key                     |
| `folder_id` | `uuid`         | no   | owning Folder                  |
| `title`     | `varchar(200)` | no   | nonblank displayed title       |
| `position`  | `integer`      | no   | zero-based order within Folder |
| timestamps  | `timestamptz`  | no   | creation/update                |

Constraints and indexes:

- `bookmarks_folder_church_fk`: composite `(folder_id, church_id)` references
  `folders(id, church_id) ON DELETE CASCADE`.
- `bookmarks_folder_position_uk`: deferrable unique
  `(folder_id, position)`.
- `bookmarks_position_ck`: `position >= 0`.
- `bookmarks_church_folder_position_idx`:
  `(church_id, folder_id, position, id)` for tenant-scoped listing.

### `scripture_bookmarks`

| Column                     | Type       | Null | Contract                               |
| -------------------------- | ---------- | ---- | -------------------------------------- |
| `bookmark_id`              | `uuid`     | no   | PK, FK to Bookmark `ON DELETE CASCADE` |
| `book_id`                  | `uuid`     | no   | canonical book                         |
| `chapter_number`           | `smallint` | no   | positive                               |
| `start_verse`              | `smallint` | no   | non-negative inclusive start           |
| `end_verse`                | `smallint` | no   | inclusive end, at or after start       |
| `primary_translation_id`   | `uuid`     | no   | first/only displayed translation       |
| `secondary_translation_id` | `uuid`     | yes  | optional paired translation            |

Constraints:

- `scripture_bookmarks_range_ck`: positive chapter, non-negative verses, and
  `end_verse >= start_verse`.
- `scripture_bookmarks_translations_ck`: secondary is null or differs from
  primary.
- Four composite FKs validate primary start/end and optional secondary
  start/end against `bible_verses_location_uk`, all `ON DELETE RESTRICT`.
- A deferred `bookmark_scripture_total_ck` constraint trigger requires every
  Bookmark to have exactly one ScriptureBookmark at commit and rejects deleting
  the subtype without its parent. The trigger permits parent/subtype insertion
  and aggregate deletion within one transaction; it returns successfully when
  the parent no longer exists during cascade deletion.

The composite FKs prove endpoints, not continuity of every intermediate verse.
Search/import reconciliation must reject gaps in the inclusive range.

## Ownership and deletion matrix

| Parent or action            | Relation/target                 | DB action | Required behavior                                                |
| --------------------------- | ------------------------------- | --------- | ---------------------------------------------------------------- |
| Delete User                 | Account, Session                | CASCADE   | remove credential/session rows                                   |
| Delete User                 | actor subtype                   | CASCADE   | remove membership or operator assignment                         |
| Delete Church               | ChurchMembership                | CASCADE   | remove tenant assignment                                         |
| Delete Church               | Folder                          | CASCADE   | start church-content physical deletion                           |
| Delete Folder               | Bookmark                        | CASCADE   | remove only bookmarks in that folder                             |
| Delete Bookmark             | ScriptureBookmark               | CASCADE   | remove typed payload                                             |
| Delete Church               | associated User                 | no FK     | service transaction explicitly deletes initial User after Church |
| Delete Translation or Book  | names, verses, saved references | RESTRICT  | master removal requires explicit migration/reconciliation        |
| Delete BibleVerse           | ScriptureBookmark endpoint      | RESTRICT  | saved ranges prevent endpoint deletion                           |
| Delete Verification/Session | expired row                     | direct    | bounded cleanup; no retained auth history                        |

Church deletion captures the initial membership User ID, deletes the Church
aggregate and then the User in one transaction. This explicit step avoids a
foreign-key cascade from a tenant into an identity that could later have other
memberships. Suspension is not deletion and revokes sessions without deleting
content.

## Representative queries and index rationale

| Use case                    | Required predicate/order                                                               | Supporting index                                                           |
| --------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Login identity              | `users.email = normalized_email`                                                       | `users_email_uk`                                                           |
| Validate session            | `sessions.token = token AND expires_at > now()`                                        | `sessions_token_uk`                                                        |
| Revoke/list User sessions   | `user_id = ?`                                                                          | `sessions_user_expires_idx`                                                |
| Cleanup sessions            | `expires_at <= cutoff ORDER BY expires_at LIMIT ?`                                     | `sessions_expires_idx`                                                     |
| Resolve tenant actor        | membership by `user_id`, then Church                                                   | `church_memberships_user_uk`                                               |
| Search verse range          | translation/book/chapter and verse `BETWEEN`, ordered by verse                         | `bible_verses_location_uk`                                                 |
| Bilingual location display  | book/chapter/verse and translation `IN (...)`                                          | `bible_verses_navigation_idx`                                              |
| Next/previous location      | canonical book order plus chapter/verse tuple comparison; fetch requested translations | book canonical UK + navigation index                                       |
| Folder menu                 | tenant; pinned by position then unpinned by recent use; limit 20                       | pinned and recent Folder indexes                                           |
| Folder bookmarks            | `church_id = ? AND folder_id = ? ORDER BY position, id`                                | `bookmarks_church_folder_position_idx`                                     |
| Tenant-safe bookmark lookup | `church_id = ? AND id = ?`, joining Folder and ScriptureBookmark                       | Bookmark PK plus tenant predicate; add `(church_id,id)` if plans show need |

Do not add speculative indexes before a representative `EXPLAIN` shows benefit.
Issue #49 captures synthetic query plans and may add `(church_id, id)` when the
tenant-safe point lookup cannot use an acceptable plan at expected scale.

## Reorder transaction

For Folder reorder, lock `churches.id`; for Bookmark reorder, lock `folders.id`.
Then:

1. validate the submitted IDs exactly equal the owner-scoped current set;
2. `SET CONSTRAINTS <position constraint> DEFERRED`;
3. update every row to its zero-based requested position;
4. query back the complete order and assert contiguous positions; and
5. commit.

Create and physical delete use the same owner lock and compact positions in the
same transaction. A stale submitted set returns a conflict and never performs a
partial reorder.

## Expand, migrate, contract sequence

| Phase         | Issue           | Expand                                                                    | Migrate/reconcile                                                              | Contract                                                       |
| ------------- | --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Auth/tenant   | #42             | add extension, enums, auth/actor/Church tables and nullable-safe mappings | create only synthetic dev/test actors; compare Better Auth generated candidate | validate triggers/checks; no production application            |
| Bible         | #46 / #47 / #48 | add translation/book/name/verse tables with non-null text, no nonblank CK | profile approved dump, import idempotently, reconcile counts/locations         | add nonblank CK only with approved evidence; reject mismatches |
| Saved content | #54             | add Folder/Bookmark/ScriptureBookmark and indexes                         | no legacy migration; synthetic fixtures only                                   | validate total subtype and reorder constraints                 |

Every implementation migration is immutable after merge. A constraint added to
existing data is created `NOT VALID` when appropriate, validated after a
reconciliation query reports zero violations, then made the target contract.

## Integration-test matrix

| Area               | Allowed case                                            | Rejected case(s)                                                               |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Email              | normalized unique address                               | case variant, leading/trailing whitespace, overlength                          |
| Credential Account | one credential hash per User                            | second credential; null password; any OAuth token/provider                     |
| Actor              | pending none; active exactly one subtype                | active none; pending subtype; operator plus membership; concurrent dual insert |
| Membership         | one User and one Church                                 | duplicate User or duplicate Church                                             |
| Suspension         | active/null and suspended/timestamp                     | inconsistent status/timestamp                                                  |
| Session            | unique token and future expiry                          | duplicate token; expiry not after creation; cascade scope                      |
| Bible masters      | unique stable code/order/name                           | duplicate code/order/name; blank name; invalid code                            |
| Verse              | unique canonical location; chapter > 0 and verse >= 0   | invalid number; duplicate location; missing parent                             |
| Folder ownership   | tenant Folder with unique position                      | cross-tenant Bookmark/Folder pair; duplicate/negative position                 |
| Bookmark subtype   | parent and typed child in one transaction               | parent without child; child without parent; subtype-only delete                |
| Scripture range    | existing inclusive primary/optional-secondary endpoints | reverse range; same translations; missing endpoint; nonexistent book/chapter   |
| Reorder            | serialized complete-set reorder                         | stale/missing/foreign ID set; concurrent duplicate position                    |
| Deletion           | Folder removes only its Bookmarks                       | church content deletes Bible master; endpoint deletion breaks saved range      |

Tests query `pg_constraint`, `pg_indexes`, and extension state so a Prisma model
that looks correct but omits raw SQL cannot pass.
