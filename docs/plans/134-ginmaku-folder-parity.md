# Match Ginmaku folder and bookmark workflows

## Issue

- Issue: #134
- Branch: `codex/issue-134`
- Base commit: `ec1dafe4c28a20dc26405151cf947c8614fdb433`

## Outcome

Levi's scripture screen uses the same folder and favorite structure as Ginmaku:
the sidebar is an accordion of folder headers and scripture links, creation and
editing are separate actions below it, and the current scripture is saved with
the `お気に入りに追加` action after the search form.

## Binding legacy evidence

- Ginmaku commit `4b18adb02ac8011630c76137c60038e168f05534`.
- `app/views/shared/_bookmark.html.erb`: accordion, new-folder form, edit link,
  and sortable bookmark list.
- `app/views/shared/_add_to_bookmark.html.erb`: automatic-title favorite action.
- `app/views/books/index.html.erb`: favorite action immediately after search.
- `app/views/folders/edit.html.erb`, `_form.html.erb`, and
  `_content_bookmarks.html.erb`: separate folder management and bookmark rows.
- `app/models/book_search_form.rb`: `book Japanese/English chapter:range`
  favorite title.
- User screenshots from 2026-08-22 and 2026-08-23.

## Current divergence

- The open accordion body mixes rename, pin, deletion, bookmark-title input,
  save, and bookmark management into the scripture screen.
- Folder ordering arrows appear beside every open header although Ginmaku does
  not show them there.
- Folder creation accepts one arbitrary name instead of date plus meeting name.
- There is no separate current-folder editor.
- Bookmark saving is inside the open folder and asks the operator to retype a
  title instead of deriving it from the selected scripture.

## Constraints

- Preserve church ownership, tenant-safe 404 behavior, strict command parsing,
  physical deletion, pinned-first/recent ordering, and the 20-folder limit.
- Preserve direct audience-tab behavior and the existing Bible search contract.
- Keep same-folder drag ordering and an accessible keyboard reorder path without
  placing visible order arrows beside folder headers.
- Use native links/buttons and the black Ginmaku surface; do not add a design
  system or modal that is absent from the legacy workflow.
- Required CI Quality, Database, E2E, and Security must succeed on the exact PR
  head before merge.

## Non-goals

- Reproducing Rails, jQuery UI, or Ginmaku's authentication model.
- Moving bookmarks between folders.
- Weakening Levi's normalized bookmark data model.
- Changing non-folder scripture or projection behavior.

## Plan

1. [x] Read the pinned Ginmaku source and map each legacy control to Levi.
2. [x] Refactor the scripture sidebar to folder headers plus bookmark links only.
3. [x] Implement Ginmaku's date/meeting creation form and current-folder edit
       link below the accordion.
4. [x] Move automatic-title `お気に入りに追加` below the scripture form.
5. [x] Add tenant-scoped folder and bookmark edit surfaces, including rename,
       pin, physical delete, bookmark title update/delete, and drag reorder.
6. [x] Align CSS dimensions, spacing, icons, collapsed/open states, and feedback
       with the legacy surfaces.
7. [x] Update component, domain/controller, integration, and latest-Chrome E2E
       coverage plus product/parity documentation.
8. [ ] Run canonical verification and merge only after exact-head CI succeeds.

## Progress

- 2026-08-23 JST — Compared the reported Levi screen with the complete pinned
  Ginmaku view, model, controller, and stylesheet implementation. Confirmed that
  the current clutter comes from management operations previously accepted as
  an accordion non-goal.
- 2026-08-23 JST — Rebuilt the sidebar as a Ginmaku accordion, moved creation,
  editing, and automatic-title favorites to their legacy positions, and added
  separate tenant-scoped folder and bookmark editors.
- 2026-08-23 JST — Inspected the rendered Chrome layout and corrected the search
  form and favorite action to begin at Ginmaku's 230px content offset.
- 2026-08-23 JST — Unit, component, and nine latest-Chrome E2E scenarios pass,
  including creation, save, reorder, edit, reopen, and physical deletion.

## Decisions

- 2026-08-23 — Treat the pinned source as authoritative for control placement,
  while retaining Levi's stronger tenant and validation boundaries.
  - Reason: the latest product instruction explicitly requests complete Ginmaku
    parity and the source resolves ambiguities in screenshots.
- 2026-08-23 — Keep management out of the scripture accordion.
  - Reason: Ginmaku exposes only the folder title and bookmark links there; all
    folder/bookmark mutation is reached through `フォルダの編集`.
- 2026-08-23 — Derive favorite titles from canonical search state.
  - Reason: this is Ginmaku behavior and removes duplicate operator input.

## Risks and mitigations

- Risk: moving controls could regress an existing retained capability.
  - Mitigation: preserve each operation on the edit surfaces and exercise the
    complete lifecycle in E2E.
- Risk: separate edit URLs could expose cross-church content.
  - Mitigation: load and mutate exclusively through tenant-scoped APIs and test
    foreign/guessed identifiers as indistinguishable.
- Risk: visual DOM tests may miss layout divergence.
  - Mitigation: inspect the rendered latest-Chrome screen and assert the absence
    and placement of legacy-incompatible controls.

## Verification

- [x] `pnpm check`
- [x] `pnpm db:check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: source-based behavior map, implementation, rendered verification,
  and latest-Chrome E2E coverage.
- Remaining: PR, exact-head CI, merge, lease release, and main synchronization.
- Blocker: none.
- Resume with: prepare the PR and wait for exact-head CI.
