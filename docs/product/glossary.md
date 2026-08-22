# Product glossary

Terms marked **provisional** require confirmation from the product owner or
legacy-system evidence. Update the definition and remove the marker when the
meaning is verified.

| Term                 | Definition                                                                                                         | Status / evidence                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Ginmaku 2            | The current system that Levi will replace.                                                                         | Confirmed project context; implementation details not yet inventoried. |
| Levi                 | The replacement web-based worship presentation system in this repository.                                          | Confirmed project context.                                             |
| Worship service      | The real-world event whose preparation and presentation workflows Levi supports.                                   | Confirmed at a high level; service variants are unknown.               |
| Platform operator    | The Levi service operator who creates churches and their initial accounts through the protected administration UI. | Confirmed for the initial release in Issue #38.                        |
| Church user          | The single initial account belonging to one church and allowed to use that church's protected data.                | Confirmed for the initial release in Issue #38.                        |
| Operator             | A signed-in church user controlling Bible search and audience presentation during a worship service.               | Confirmed for the initial release; church-internal roles are excluded. |
| Search window        | The latest-Chrome window containing the Ginmaku-compatible Bible search and saved-content controls.                | Confirmed for the initial release in Issue #106.                       |
| Audience window      | A separate named latest-Chrome tab containing only content and display state intended for attendees.               | Confirmed for the initial release in Issue #106.                       |
| Bible location       | A canonical book, chapter number, and verse number, independent of translation and storage ID.                     | Confirmed by the initial-release specification.                        |
| Search range         | The inclusive one-chapter range that seeds Bible results; it does not bound later presentation navigation.         | Confirmed replacement behavior in Issue #38.                           |
| Presentation         | The audience-tab display of the current Bible location and selected translation or translations.                   | Confirmed for the initial release in Issue #106.                       |
| Pinned folder        | A church-owned folder deliberately prioritized ahead of non-pinned recent folders.                                 | Confirmed retained behavior in Issue #38.                              |
| Recently used folder | A folder ordered by the time it was explicitly selected or one of its bookmarks was reopened.                      | Confirmed replacement semantics in the initial-release specification.  |
| Service plan         | Prepared data describing what will be presented during a worship service.                                          | **Provisional**; confirm the legacy term and data model.               |
| Live mode            | A state in which operator actions may change an audience display.                                                  | **Provisional**; safety and synchronization rules are unknown.         |
| Rehearsal            | Verification of prepared content without affecting a live service.                                                 | **Provisional**; required workflow is unknown.                         |
| Parity item          | A legacy capability or approved replacement behavior tracked with evidence and acceptance criteria.                | Defined by Issue #11.                                                  |
| Walking skeleton     | The smallest end-to-end implementation proving build, database, tests, browser flow, and CI work together.         | Engineering term for the foundation phase.                             |

## Adding terms

For each domain term, record one precise definition, aliases used by Ginmaku 2,
evidence, and whether the meaning is accepted or provisional. Do not use one term
for multiple domain concepts.
