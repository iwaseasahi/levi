# Keep Slide body vertical alignment consistent

## Issue

- Issue: #498
- Branch: `codex/issue-498`
- Base commit: `6b1ec963bfe255d3bd35e4c24c3f1be800c57d17`

## Outcome

Church members can select top, center, or bottom alignment for the whole body of
a text Slide and see the same safe, fitted position in the editor, unsaved
preview, saved detail, and audience after reload and blank recovery.

## Context

- `src/app/slides/slide-rich-text-editor.tsx` owns the editable 16:9 surface and
  `src/app/slides/slide-text.tsx` is the shared read-only preview/audience
  renderer.
- `src/app/styles/slides.css` currently centers both surfaces unconditionally.
- ADR 0017 keeps authored rich text application-owned and Tiptap-independent.
  Vertical placement applies to the whole Slide, not a paragraph or selection.
- `slides.text_document` is now required for text Slides after #501; the former
  plain-text API compatibility view is derived from that document.
- Relevant installed Next.js guidance was read from
  `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`,
  `01-app/01-getting-started/05-server-and-client-components.md`, and
  `03-architecture/accessibility.md`.

## Constraints

- Accept only `top | center | bottom`; never accept coordinates, spacing, or
  CSS values through the API or persistence boundary.
- Keep missing legacy values visually centered and keep image Slides free of
  this setting and control.
- Preserve text fitting, relative run sizes, paragraph alignment, IME/caret,
  tenant ownership, revision conflicts, projection handshake, blanking, and
  fail-closed audience behavior.
- Use a forward migration only. Production migration and deployment remain
  outside this Issue and require separate approval.

## Non-goals

- Per-paragraph or per-selection vertical placement.
- Arbitrary coordinates, margins, multiple text boxes, or image placement.
- Changes to text-document nodes/marks or projection transport.

## Plan

1. [x] Add a strict application-owned vertical-alignment enum/default to the
       Slide input and record contracts, plus nullable enum persistence that keeps
       existing rows centered and image rows unset.
2. [x] Add a distinct accessible toolbar group and propagate its state through
       editor, unsaved preview, save/reload, detail, and audience.
3. [x] Share top/center/bottom layout semantics across editable and read-only
       16:9 surfaces while preserving bounded fit and safe padding.
4. [x] Add domain, API/component, integration/schema, and Chromium acceptance
       coverage for valid/default/invalid values, image exclusion, focus, responsive
       geometry, persistence, audience, and blank recovery.
5. [ ] Update ADR 0017, Slide contract, data-model dictionary, and testing
       acceptance map, then run all applicable canonical checks and exact-head CI.

## Progress

- 2026-09-07 JST — Read #498 and dependencies #479/#487, governance and agent
  protocols, ADR 0017, the Slide contract/data model/testing documents, current
  implementation and installed Next.js guidance. Created the isolated worktree,
  installed the frozen lockfile, and acquired writer lease `codex-498-1`.
- 2026-09-07 12:58 JST — Implemented the strict Slide-level enum/default,
  forward migration, accessible toolbar, and shared editor/read-only placement;
  updated the required contracts and acceptance map. Evidence: `pnpm check`
  passed (542 unit and 124 component tests plus lint, typecheck, configuration
  checks, and production build); fresh-database `pnpm test:integration` passed
  141 tests; `pnpm test:e2e` passed 35 Chromium tests; `pnpm security:check` and
  `pnpm backup:rehearse` passed. The final E2E rerun remains pending after
  strengthening the maximum-200% assertion and standardizing editor insets.

## Decisions

- 2026-09-07 — Decision: store vertical alignment as a nullable Slide-level DB
  enum and expose a normalized application value for text Slides.
  - Reason: placement is a whole-Slide setting rather than authored rich-text
    structure. A nullable column preserves existing rows, whose missing value is
    normalized to `center`, while the enum prevents arbitrary persisted values.
  - Alternatives: adding a new `SlideTextDocument` version would couple a
    surface setting to content and create an unnecessary editor-document
    compatibility boundary; storing CSS or coordinates violates the Issue.
  - ADR: amend ADR 0017 to record that this setting remains outside the rich-text
    document.

## Risks and mitigations

- Risk: long fitted content could move outside the safe 16:9 area.
  - Mitigation: retain one uniform fit calculation and assert top/bottom bounds
    at editor and audience viewport sizes.
- Risk: toolbar clicks could collapse the editor selection or disrupt IME.
  - Mitigation: prevent pointer-down focus transfer as existing format buttons
    do, preserve Escape/Alt+F10 flow, and add component/E2E coverage.
- Risk: image/text conversion could leave a stale text-only setting.
  - Mitigation: explicitly clear it on image writes and constrain image rows at
    the database boundary.
- Risk: adding a CHECK could hold an avoidable blocking validation lock.
  - Mitigation: add it `NOT VALID`, validate explicitly, and keep the new enum
    column nullable without a default or table rewrite.

## Verification

- [x] `git diff --check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm db:check`
- [x] `pnpm test:integration`
- [ ] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `pnpm backup:rehearse`
- [x] `pnpm build`
- [ ] Acceptance criteria — mapped automated evidence in domain, component,
      integration, and Chromium suites.
- [ ] Final diff reviewed for scope, secrets, migration/data-loss risk, auth,
      concurrency, error handling, and unsafe defaults.

## Handoff or blockers

- Completed: intake, isolation, dependency install, writer lease, and design
  decision.
- Remaining: implementation, documentation, verification, review, PR, and CI.
- Blocker: none.
- Resume with: implement the domain and Prisma contract with focused tests.

## Result

Pending.
