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
and would admit more markup than this feature needs. The initial rollout kept
the former plain `body` field while existing rows were migrated.

## Decision

Use exact-pinned Tiptap 3.31.3 with a constrained ProseMirror schema. Authorable
blocks are paragraphs and flat bullet lists. Authorable inline marks are bold,
italic, underline, and a 50–200% font size selected in 10% steps. Paragraphs
and list items support left, center, or right alignment. Paste and drop accept
plain text and LF only; unsupported nodes,
marks, attributes, sizes, files, nested lists, and rich HTML are rejected or
discarded.

Persist the application-owned Slide text document JSON in
`slides.text_document`. Its internal `version` field is a schema discriminator,
not part of the product-facing document name. It contains the constrained
blocks, alignments, text marks, and sized runs above. After the product owner
confirmed development and production data migration on 2026-09-07, the document
became required for text Slides and the duplicated database `body` column was
removed. The API may expose a flattened plain-text `body` for compatibility,
but the application derives it from the validated document. Image Slides have
no text document. The unreleased earlier document experiment remains rejected.

Rendering maps only the versioned allowlist to React paragraphs, lists, and
styled text spans; neither stored HTML nor raw Tiptap JSON reaches
`dangerouslySetInnerHTML`. Preview and audience share the same fit-to-frame
calculation. Slide projection has no transient font multiplier; authored run
sizes are its only text-size control.

The original migration was expand-first. The contract migration fails closed
unless every text Slide already has an eligible document, validates the
replacement text/image constraint, then removes the rollback trigger and
`body`. Rollback after this contraction requires an application version that
reads `text_document`; a body-only writer is no longer compatible.

## Consequences

- Durable content is independent of Tiptap and can be rendered without loading
  the editor library.
- Selection formatting, undo/redo, IME, and keyboard behavior use a maintained
  editing engine instead of a bespoke `contenteditable` implementation.
- There is one persisted source for text content. Plain text needed by existing
  API and rendering boundaries is deterministically flattened from it.
- Future blocks or marks require a new document version and an ADR/schema
  compatibility review; arbitrary HTML, links, media, colors, fonts, and
  arbitrary CSS sizes remain out of scope.

## Verification

Domain tests cover normalization and rejection, adapter tests cover exact-range
formatting and malicious Tiptap trees, component tests cover editor/preview and
projection, and integration tests cover document-only persistence, migration
preconditions, and the text/image constraint.

## References

- [Issue #479](https://github.com/iwaseasahi/levi/issues/479)
- [Slide contract](../product/slide-contract.md)
- [Dependency policy](../security/dependency-policy.md)
