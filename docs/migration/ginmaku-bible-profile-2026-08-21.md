# Ginmaku production Bible profile — 2026-08-21

## Handling evidence

- Input fingerprint: SHA-256
  `5600e06968a78c32227094678444fc7a028c76d338276044d5d9c1c629eb2bd7`
- Size: 37,585,883 bytes; UTF-8 SQL; source file remained unchanged.
- Processing was local and read-only. No dump, Bible text, or name value was
  copied to the repository, Issue, PR, fixture, or artifact. Authorized local
  inspection was limited to identifying the translation and is not retained.
- Temporary aggregate output was deleted after inspection; the original remains
  under product-owner control.
- On 2026-08-21 the product owner confirmed Levi has Bible display rights and
  approved preserving the production `books` rows without modification.

## Anonymous profile

| Evidence                                           |                                             Result |
| -------------------------------------------------- | -------------------------------------------------: |
| `book_names`                                       | 66 rows; IDs 1–66; 39 old / 27 new; no NULL fields |
| `books`                                            |                                        62,325 rows |
| version 1                                          |                               31,220 rows → `JSS3` |
| version 2                                          |                               31,105 rows → `NKJV` |
| NULL fields                                        |                                                  0 |
| duplicate translation/book/chapter/verse locations |                                                  0 |
| verse-number gaps inside a chapter                 |                                                  0 |
| unknown `book_name_id` references                  |                                                  0 |
| unexpected version/testament values                |                                                  0 |
| invalid book/chapter/verse coordinates             |                                                  0 |
| verse 0                                            |                         116 rows; retained exactly |
| trimmed-empty text                                 |                              5 rows, all version 1 |

The 116 verse-zero rows are valid source locations and are retained without
renumbering. Levi therefore permits verse numbers greater than or equal to zero.

The five empty values are retained exactly as empty strings at legacy locations
42/1/2, 42/1/75, 42/11/51, 45/2/20, and 45/16/26. They are not skipped,
repaired, or converted to NULL. Therefore `bible_verses_text_nonblank_ck` must
not be added.

## Mapping and stop conditions

- `version=1` maps to `JSS3`; `version=2` maps to `NKJV`. Authorized local text
  inspection disproved the former KJV assumption, and the product owner selected
  NKJV explicitly.
- `book_name_id` 1–66 maps by canonical order to the typed mapping in
  `src/migration/ginmaku-bible-mapping.ts`; legacy `books.id` is never retained
  as navigation identity.
- Import must stop on unknown version/book IDs, NULLs, non-positive book/chapter
  values, negative verse values,
  duplicate locations, parser/schema mismatch, or count/fingerprint mismatch.
- Empty text is an approved preserved value and is not a stop condition.

Sample verification uses only location-bound SHA-256 fingerprints. No source
text is recorded in this report.
