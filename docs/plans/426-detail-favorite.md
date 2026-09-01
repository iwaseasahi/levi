# Add Slide favorites from detail

- Issue #426; branch `codex/issue-426`.
- Reuses the typed Slide bookmark API delivered by #420.

## Plan

1. [x] Inspect detail/sidebar state, controller placement and existing list save flow.
2. [x] Connect the selected folder to the detail document, remove revision text and
       add the styled save action after the blank control.
3. [x] Verify success, disabled and error behavior plus sidebar refresh with
       component and Chromium coverage.
4. [ ] Run required validation, open a PR, verify exact-head CI and merge.

No schema, migration, dependency or production operation is required.
