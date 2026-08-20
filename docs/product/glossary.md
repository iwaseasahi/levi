# Product glossary

Terms marked **provisional** require confirmation from the product owner or
legacy-system evidence. Update the definition and remove the marker when the
meaning is verified.

| Term | Definition | Status / evidence |
| --- | --- | --- |
| Ginmaku 2 | The current system that Levi will replace. | Confirmed project context; implementation details not yet inventoried. |
| Levi | The replacement web-based worship presentation system in this repository. | Confirmed project context. |
| Worship service | The real-world event whose preparation and presentation workflows Levi supports. | Confirmed at a high level; service variants are unknown. |
| Operator | A person controlling or preparing the presentation experience. | **Provisional**; roles and permissions are not defined. |
| Audience display | The browser window, screen, projector output, or other surface visible to attendees. | **Provisional**; supported display topology is not defined. |
| Presentation | An ordered, audience-visible sequence or state used during a worship service. | **Provisional**; legacy behavior must define its boundaries. |
| Service plan | Prepared data describing what will be presented during a worship service. | **Provisional**; confirm the legacy term and data model. |
| Live mode | A state in which operator actions may change an audience display. | **Provisional**; safety and synchronization rules are unknown. |
| Rehearsal | Verification of prepared content without affecting a live service. | **Provisional**; required workflow is unknown. |
| Parity item | A legacy capability or approved replacement behavior tracked with evidence and acceptance criteria. | Defined by Issue #11. |
| Walking skeleton | The smallest end-to-end implementation proving build, database, tests, browser flow, and CI work together. | Engineering term for the foundation phase. |

## Adding terms

For each domain term, record one precise definition, aliases used by Ginmaku 2,
evidence, and whether the meaning is accepted or provisional. Do not use one term
for multiple domain concepts.

