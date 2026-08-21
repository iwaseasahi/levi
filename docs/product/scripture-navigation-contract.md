# Scripture navigation contract

## Endpoint

`GET /api/scripture/navigate` accepts exactly one value for each query field:

- `book`: canonical book code;
- `chapter` and `verse`: the current canonical location;
- `direction`: `previous` or `next`; and
- `language`: `ja`, `en`, or `both`.

The endpoint requires an active church session without a forced password
change. Responses are private operational state and always use
`Cache-Control: no-store`.

A successful move returns the adjacent `item`, `crossedChapter`, and
`crossedBook`. The boolean signals describe the move just completed; the item
location remains the source of truth for subsequent navigation.

## Canonical movement

Movement compares the tuple
`(canonical_order, chapter_number, verse_number)` and selects the nearest
existing tuple in the requested direction. It does not add or subtract verse
numbers, depend on row IDs or localized names, or depend on the original search
result array. Therefore it:

- continues after the search ending verse;
- crosses chapter, book, and Old/New Testament boundaries in both directions;
  and
- skips absent verse numbers while preserving canonical order.

Books without approved corpus rows are skipped. Reaching the first or last
location in the whole approved corpus returns `item: null` with `edge:
book-start` or `edge: book-end`.

## Translation integrity

JSS3 and NKJV share one logical canonical location. The adjacent location is
selected from the approved corpus before applying the requested language. Every
requested translation must then exist at that exact location. A missing row is
reported as `TRANSLATION_NOT_AVAILABLE`; navigation never silently skips the
location and drifts the two translations.

## Controller ordering

The controller submits previous/next actions through one promise queue. Rapid
clicks and keyboard actions execute in input order. A successful response
becomes the complete current projection state, including locations outside the
initial search range. A denied session clears the audience window and removes
protected controller content.
