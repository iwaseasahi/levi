# Legacy Ginmaku inventory

Inventory source: public repository commit
`4b18adb02ac8011630c76137c60038e168f05534`. Every item below is
**observed-in-code**; runtime use remains unverified.

## Screens and operations

| Surface           | Observed behavior                                                                                                                                          | Primary source paths                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Home              | Links to Bible search, praise-song search, and message slides                                                                                              | `config/routes.rb`, `app/views/homes/top.html.erb`                                      |
| Bible             | Select book/chapter/verse range and Japanese/English/both; open a named projector window; adjust font and navigate verses remotely                         | `books_controller.rb`, `book_search_form.rb`, `books/index.html.erb`, `books.js.coffee` |
| Songs             | Search lyrics/reading and key, show recent/all, CRUD, preview, soft-delete, generate romanized lines, present phrases, blank/half-screen/navigate remotely | `songs_controller.rb`, `song.rb`, song views, `songs.js.coffee`, `common.js.coffee`     |
| Slides            | Search body, show recent/all, CRUD, preview, soft-delete, split body into pages, present/blank/navigate remotely                                           | `slides_controller.rb`, `slide.rb`, slide views, `slides.js.coffee`, `common.js.coffee` |
| Bookmarks/folders | Save route parameters, select current folder in session, sticky/recent folders, reorder and delete entries                                                 | bookmark/folder controllers, models, views                                              |
| PDF               | Link a song ID to `/pdf/<id>.pdf` when the configured filesystem file exists                                                                               | `songs_helper.rb`, `config/settings/*.yml`                                              |

The projector pattern uses a browser window named `projector`. A controller page
opens or reuses it and invokes functions on that window to switch content,
blank/unblank, resize, or scroll. Popup policy, multi-display behavior, failure
recovery, and supported browsers are not documented.

## Data model

The Rails migrations define the following source tables without database-level
foreign keys or explicit uniqueness constraints:

| Table        | Source fields relevant to migration                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `book_names` | integer ID, testament, Japanese name, English name                                                                    |
| `books`      | integer ID, version, book-name ID, chapter, verse, word text                                                          |
| `songs`      | integer ID, code/key, title, words, search-normalized words, copyright, deleted timestamp, created/updated timestamps |
| `song_edits` | integer ID, song ID, historical words, created/updated timestamps                                                     |
| `slides`     | integer ID, title, body, author, deleted timestamp, created/updated timestamps                                        |
| `bookmarks`  | integer ID, title, controller/action names, JSON route parameters, folder ID, position, timestamps                    |
| `folders`    | integer ID, title, sticky flag, timestamps                                                                            |

Legacy IDs are relational migration keys even where the database does not enforce
the relation. Preserve them in staging mappings; do not expose them as Levi's
long-term identifiers without a separate decision.

## Integrations and operations

- Rails 3.2 with MySQL, Unicorn, asset pipeline, jQuery/CoffeeScript.
- HTTP Basic authentication backed by `BASIC_USERNAME`/`BASIC_PASSWORD`.
- Cookie session stores the current folder selection.
- Song PDFs are read from a configured local filesystem directory.
- No outbound service/API integration was found in the inspected application
  paths; runtime infrastructure outside the repository remains unverified.
- Production credentials, deployment topology, backups, monitoring, and restore
  procedures were not present in approved evidence.

Rails, MySQL, Unicorn, CoffeeScript, and the exact popup implementation are
implementation details, not automatic parity requirements. Observable operator
behavior and data semantics must be evaluated separately.
