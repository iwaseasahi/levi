# Initial vertical-slice candidates

Score each candidate from 1 (least favorable) to 5 (most favorable). For
`dependency/risk`, 5 means low dependency and low risk. Product value requires
product-owner confirmation; current scores are source-derived hypotheses.

| Candidate                                                   | User value | Evidence quality | Data readiness | Dependency/risk | Testability | Total / 25 | Current decision                                                |
| ----------------------------------------------------------- | ---------- | ---------------- | -------------- | --------------- | ----------- | ---------- | --------------------------------------------------------------- |
| Message slide: create → preview → search → present/navigate | 4          | 4                | 5              | 4               | 5           | 22         | recommended first                                               |
| Song: search → select → present/navigate                    | 5          | 4                | 2              | 2               | 4           | 17         | blocked on content/romanization rights and display requirements |
| Bible: select range/language → present/navigate             | 5          | 4                | 1              | 2               | 4           | 16         | blocked on corpus export/provenance                             |
| Bookmark folder: create → add target → reorder → reopen     | 3          | 4                | 4              | 4               | 4           | 19         | follow a retained content workflow                              |

## Recommended first slice

Start discovery/design with **message slide create → preview → search →
present/navigate**. The legacy schema is self-contained (`title`, `body`,
`author`, timestamps, soft deletion), source evidence defines page splitting,
and fully synthetic text can cover the workflow without importing licensed or
production content. It exercises persistence, search, controller/audience view
coordination, responsive projection, and E2E while avoiding Bible/song data
blockers.

Before opening its implementation Issue, the product owner must confirm:

- that message slides remain a `must` workflow;
- whether four consecutive newline characters remain the page delimiter;
- the controller/audience window and supported browser/display topology;
- create/edit/delete authorization and soft-delete retention;
- required loading, empty, invalid, audience-window-loss, and recovery states.

The implementation Issue must reference matrix rows `SLIDE-001` and `SLIDE-002`
and turn each confirmation into acceptance criteria. If confirmation changes a
score or makes another slice independent, update this table with the dated
decision rather than silently replacing the recommendation.
