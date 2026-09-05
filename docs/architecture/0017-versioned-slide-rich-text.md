# ADR 0017: Versioned application-owned Slide rich text

- Status: accepted
- Date: 2026-09-05
- Decision owner: Levi product owner
- Extends: [ADR 0015](0015-church-owned-slides.md)

## Context

Issue #479 requires a rich-text editor on the same 16:9 surface that is
projected. The product owner selected Tiptap 3 after the Issue compared
adoption, maintenance, license, accessibility, React integration, schema
control, and implementation cost. On 2026-09-06 the owner clarified that the
editor must support font size, bold, italic, underline, alignment, and bullet
lists. Heading controls were removed after product evaluation.

Persisting Tiptap JSON or HTML would make a UI dependency the durable contract
and would admit more markup than this feature needs. Existing clients and rows
also know only the plain `body` field.

## Decision

Use exact-pinned Tiptap 3.31.3 with a constrained ProseMirror schema. Authorable
blocks are paragraphs and flat bullet lists. Authorable inline marks are bold,
italic, underline, and a 60–220% font size selected in 10% steps. Paragraphs
and list items support left, center, or right alignment. Paste and drop accept
plain text and LF only; unsupported nodes,
marks, attributes, sizes, files, nested lists, and rich HTML are rejected or
discarded. Version 2 can retain legacy version-1 75% and 125% values during a
lazy upgrade, but the editor does not offer those values for new formatting.

Persist application-owned JSON in nullable `slides.text_document`. Version 1
contains sized text runs and break nodes. Version 2 contains the constrained
blocks, alignments, text marks, and sized runs above. `body` remains the derived
flattened plain text for compatibility and search/list behavior. Reads require
both forms to agree. Existing version-1 and null documents remain readable; the
editor emits version 2 on the next rich-text write.

Rendering maps only the versioned allowlist to React paragraphs, lists, and
styled text spans; neither stored HTML nor raw Tiptap JSON reaches
`dangerouslySetInnerHTML`. Preview and audience share the same fit-to-frame
calculation. The controller's existing 60–220% scale remains a transient
multiplier over the authored relative sizes.

The migration is expand-first. A rollback writer that changes `body` without
changing `text_document` triggers the database to clear the stale document, so
the later application reconstructs safe normal-sized text rather than restoring
obsolete formatting.

## Consequences

- Durable content is independent of Tiptap and can be rendered without loading
  the editor library.
- Selection formatting, undo/redo, IME, and keyboard behavior use a maintained
  editing engine instead of a bespoke `contenteditable` implementation.
- `body` and `text_document` are deliberately duplicated and every application
  read validates their equality.
- Future blocks or marks require a new document version and an ADR/schema
  compatibility review; arbitrary HTML, links, media, colors, fonts, and
  arbitrary CSS sizes remain out of scope.

## Verification

Domain tests cover normalization and rejection, adapter tests cover exact-range
formatting and malicious Tiptap trees, component tests cover editor/preview and
projection, and integration tests cover persistence and rollback behavior.

## References

- [Issue #479](https://github.com/iwaseasahi/levi/issues/479)
- [Slide contract](../product/slide-contract.md)
- [Dependency policy](../security/dependency-policy.md)
