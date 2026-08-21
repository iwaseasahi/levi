# Initial vertical-slice candidates

Score each candidate from 1 (least favorable) to 5 (most favorable). For
`dependency/risk`, 5 means low dependency and low risk. Product value requires
product-owner confirmation; current scores are source-derived hypotheses.

| Candidate                                                   | User value | Evidence quality | Data readiness | Dependency/risk | Testability | Total / 25 | Current decision                                   |
| ----------------------------------------------------------- | ---------- | ---------------- | -------------- | --------------- | ----------- | ---------- | -------------------------------------------------- |
| Message slide: create → preview → search → present/navigate | 4          | 4                | 5              | 4               | 5           | 22         | mandatory after the initial release; Issue #59     |
| Song: search → select → present/navigate                    | 5          | 4                | 2              | 2               | 4           | 17         | excluded initially; optional later                 |
| Bible: select range/language → present/navigate             | 5          | 4                | 1              | 2               | 4           | 16         | approved first slice on 2026-08-21; Issues #46–#53 |
| Bookmark folder: create → add target → reorder → reopen     | 3          | 4                | 4              | 4               | 4           | 19         | included with the first slice; Issue #54           |

## Approved first slice

On 2026-08-21, the product owner selected **Bible search → separate-window
presentation → page operation**, followed in the same initial release by Bible
search bookmarks/folders. The search retains the legacy book/chapter/range and
language selection while navigation deliberately removes the legacy end-range
and chapter-boundary fences. See
[`../product/initial-release-spec.md`](../product/initial-release-spec.md).

This product decision supersedes the earlier source-derived slides-first
recommendation. Slides remain mandatory later work under Issue #59, with
physical deletion and no edit history. Bible profiling and import remain gated
on approved dump handling and content rights; implementation and CI use
synthetic fixtures until that gate is satisfied.
