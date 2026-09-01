# Share the folder sidebar across signed-in church screens

- Issue #430; branch `codex/issue-430`.
- Reuses the existing SavedContentPanel and its typed Scripture/Slide links.

## Plan

1. [x] Inventory signed-in church routes and identify audience/auth/admin exclusions.
2. [x] Generalize the Slide sidebar and workspace for folder, Slide and account
       management screens; remove redundant folder return links.
3. [x] Verify navigation, selected content, responsive layout and accessibility
       with component and Chromium coverage.
4. [ ] Run canonical checks, open a PR and verify exact-head CI before merge.

No schema, migration, API, dependency or production operation is required.
