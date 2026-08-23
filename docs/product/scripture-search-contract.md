# Scripture search contract

## Endpoint and authorization

`GET /api/scripture/search` reads the shared Bible catalog for an authenticated
active church user. Catalog rows are tenant-independent, but the HTTP endpoint
still requires an active `ChurchMembership`; unauthenticated, suspended,
non-church, and forced-password-change sessions cannot read it. Responses use
`Cache-Control: no-store`.

## Query

| Parameter    | Contract                                         |
| ------------ | ------------------------------------------------ |
| `book`       | uppercase canonical book code, for example `JHN` |
| `chapter`    | integer 1–32767                                  |
| `startVerse` | integer 0–32767, inclusive                       |
| `endVerse`   | integer 0–32767, inclusive and >= start          |
| `language`   | `ja`, `en`, or `both`                            |

Unknown, missing, or repeated parameters are invalid. Searches remain inside
one book and one chapter and contain at most 500 verse numbers. Verse zero is
accepted because it exists in the approved source data.

The authenticated search form always sends this normalized API shape. When its
optional ending-verse field is empty, it uses the catalog to resolve the last
contiguous verse at or after `startVerse`; projection and bookmarks therefore
continue to receive an explicit inclusive `endVerse`.

The `/scripture` screen keeps Ginmaku's black surface, white 11px Helvetica
table, canonical three-column/twenty-two-row book order, inline range controls,
and language labels. The interaction hierarchy is modernized within that fixed
layout: selected books and languages have persistent gold-accented states,
range inputs share a dark toolbar, `Open` is the primary action, and `Reset`
and `空白⇔表示` are visually distinct secondary actions. Hover, keyboard focus,
loading, and disabled states remain visibly distinguishable. The screen has no
Church header, logout control, explanatory copy, or result-preview region. A successful
`Open` validates the range, keeps the search screen in place, and opens the
canonical `/scripture/audience` URL directly in an ordinary Chrome tab named
`projector`. Repeated opens reuse that named tab when it remains open. The URL
contains only book, chapter, normalized range, and language coordinates; it
never contains Bible text. Reopening a bookmark uses the same direct-tab flow.

The fourth table column retains Ginmaku's `文字 大／小` and `スクロール
↑／↓` behavior in a grouped projection-control panel, and the Open/Reset row
includes Ginmaku's `空白⇔表示` control.
They remain disabled until the directly opened audience sends an authenticated
same-origin readiness message. Text controls adjust the audience font
immediately. Scroll up/down selects the previous/next canonical scripture item,
matching Ginmaku terminology and behavior rather than moving a viewport offset.
Blank hides the audience scripture on the black surface while retaining the
latest location for display when toggled again. Closing the audience disables
these controls until another successful `Open`.

## Folder sidebar

The left sidebar follows Ginmaku's folder accordion. Folder headers use the
dark gradient and disclosure triangle from the legacy screen. The initial or
current folder starts open.
Selecting a header opens that folder directly below the header, closes any
other open folder, and updates its last-used time. Selecting the same header
again closes it.

`新規フォルダ作成` appears below the folder list and toggles the creation form.
The form follows Ginmaku's separate optional date and required meeting-name
fields and stores their space-joined title. The date uses latest Chrome's native
calendar control; its normalized value remains `YYYY-MM-DD`, while leaving it
empty remains valid. After a successful creation, the form closes and the new
folder opens. `フォルダの一覧` appears below creation and opens `/folders` in
the current tab. The modern dark list links to each folder's management surface.
The list, folder editor, and bookmark editor provide explicit same-tab return
links. Successful folder deletion returns to `/folders`.

The open accordion body contains only document icons and saved scripture links;
rename, pin, delete, and bookmark-title controls never appear there. Bookmarks
can be reordered with native Chrome drag-and-drop. The client submits the
complete ordered ID set for that folder; the server rejects partial, foreign,
or cross-folder orders. Alt+ArrowUp and Alt+ArrowDown provide a non-visual
keyboard fallback. A failed reorder reloads server order instead of leaving an
unpersisted order on screen.

Ginmaku's `お気に入りに追加` control appears immediately after the scripture
search form. It saves the normalized current selection into the current folder
using the automatic `日本語/English chapter:start-end` title. Folder management
supports rename, sticky/pinned state, physical folder deletion, bookmark title
editing, physical bookmark deletion, and drag ordering without cluttering the
search screen.

## Result

Results are ordered by verse and contain one item per canonical location.
Japanese uses `JSS3`, English uses `NKJV`, and `both` pairs them under one
`texts` object. Database row IDs and tenant IDs are not exposed.

```json
{
  "search": {
    "book": "JHN",
    "chapter": 3,
    "startVerse": 16,
    "endVerse": 18,
    "language": "both"
  },
  "items": [
    {
      "location": { "book": "JHN", "chapter": 3, "verse": 16 },
      "texts": {
        "japanese": { "bookName": "…", "translation": "JSS3", "text": "…" },
        "english": { "bookName": "…", "translation": "NKJV", "text": "…" }
      }
    }
  ]
}
```

The ellipses above describe response shape and are not copied Bible content.

## Errors

| HTTP | Code                        | Meaning                                         |
| ---: | --------------------------- | ----------------------------------------------- |
|  400 | `INVALID_SEARCH_INPUT`      | query contract failed                           |
|  400 | `INVALID_VERSE_RANGE`       | ending verse is before starting verse           |
|  401 | `UNAUTHENTICATED`           | no eligible session                             |
|  403 | `FORBIDDEN`                 | session cannot use the church workflow          |
|  404 | `BOOK_NOT_FOUND`            | canonical book does not exist                   |
|  404 | `CHAPTER_NOT_FOUND`         | chapter does not exist in the approved corpus   |
|  404 | `VERSE_RANGE_NOT_FOUND`     | a requested canonical verse is absent           |
|  409 | `TRANSLATION_NOT_AVAILABLE` | rights/master/chapter/verse translation missing |
|  500 | `CATALOG_INTEGRITY_ERROR`   | repository returned an impossible row shape     |
|  500 | `SEARCH_UNAVAILABLE`        | unexpected internal failure                     |

The repository performs one parameterized PostgreSQL statement. Its bounded
range uses the Bible location/navigation indexes and returns context plus rows,
so missing states do not require per-verse or per-translation queries.

## Catalog options

`GET /api/scripture/catalog` uses the same church authorization and `no-store`
policy. It accepts a required `language` and optional cascading `book` and
`chapter`; a chapter without a book, repeated values, and unknown parameters are
invalid. The response contains ordered book codes, the preferred display name,
available approved Japanese/English names, plus eligible chapter and verse
numbers for the selected depth. It never contains verse text, row IDs, or tenant
data. In bilingual mode, candidates are the canonical intersection of approved
JSS3 and NKJV locations, so the UI cannot construct a range with a known
translation gap.
