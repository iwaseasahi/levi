# ADR 0017: Versioned application-owned Slide rich text

- Status: accepted
- Date: 2026-09-05
- Decision owner: Levi product owner
- Extends: [ADR 0015](0015-church-owned-slides.md)

## Context

Issue #479 requires changing the size of only a selected text range while the
author edits the same 16:9 surface that is projected. The product owner selected
Tiptap 3 after the Issue compared adoption, maintenance, license, accessibility,
React integration, schema control, and implementation cost.

Persisting Tiptap JSON or HTML would make a UI dependency the durable contract
and would admit more markup than this feature needs. Existing clients and rows
also know only the plain `body` field.

## Decision

Use exact-pinned Tiptap 3.31.3 with a minimal ProseMirror schema: one paragraph,
text, hard breaks, history, text style, and font size. The only authorable marks
are `small` (75%), `normal` (100%), `large` (125%), and `xlarge` (150%). Paste
accepts plain text and LF only; unsupported nodes, marks, attributes, sizes,
files, and rich HTML are rejected or discarded.

Persist application-owned `SlideTextDocumentV1` JSON in nullable
`slides.text_document`. It contains only version 1 and an ordered list of text
runs with a size token or break nodes. `body` remains the canonical flattened
plain text for compatibility and search/list behavior. Reads require both forms
to agree. Existing rows with null documents are interpreted as all `normal` and
receive a document on their next write.

Rendering maps the four tokens to React text spans; neither stored HTML nor
Tiptap JSON reaches `dangerouslySetInnerHTML`. Preview and audience share the
same fit-to-frame calculation. The controller's existing 60–220% scale remains
a transient multiplier over the authored relative sizes.

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
- Future marks require a new document version and an ADR/schema compatibility
  review; arbitrary HTML and arbitrary CSS sizes remain out of scope.

## Verification

Domain tests cover normalization and rejection, adapter tests cover exact-range
formatting and malicious Tiptap trees, component tests cover editor/preview and
projection, and integration tests cover persistence and rollback behavior.

## References

- [Issue #479](https://github.com/iwaseasahi/levi/issues/479)
- [Slide contract](../product/slide-contract.md)
- [Dependency policy](../security/dependency-policy.md)
