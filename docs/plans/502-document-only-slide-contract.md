# Make Slide text document-only across API and application boundaries

## Issue

- Issue: #502
- Branch: `codex/issue-502`
- Base commit: `12d4026209e6ccf7f78a24c6a771db95ea52f492`

## Outcome

Text Slides accept and return only the validated application-owned `document`,
image Slides no longer expose a `body: null` compatibility field, and plain
text is flattened locally only where a concrete validation or display-adjacent
operation requires it.

## Context

- Issue #499 / PR #501 removed the persisted `slides.body` column; the current
  repository still derives a compatibility `body` in `SlideRecord`.
- `src/domain/slides/slide.ts`, `commands.ts`, the repository, editor, preview,
  audience session, API tests, and fixtures still model that compatibility.
- ADR 0017, the Slide contract, the data dictionary, and the Slide acceptance
  map still describe the derived API field.

## Constraints

- Keep strict versioned-document validation and allowlist rendering.
- Preserve title, alignment, image, tenant, revision, bookmark, projection,
  blank, fit, and formatting behavior.
- Do not change the database schema or immutable migration history.
- Do not place Slide content in logs, URLs, or projection control messages.
- Follow the approval boundaries in `docs/governance/autonomy.md`.

## Non-goals

- A new text-document version or editor feature.
- Vertical-alignment behavior from #498/#503.
- Production migration, deployment, or real-data conversion.

## Plan

1. [x] Replace compatibility input/output and repository mapping with required,
       strict `document` values; add focused domain/API/repository regressions.
2. [x] Convert editor, detail, preview, audience, and projection state to consume
       the document directly without forwarding flattened text.
3. [x] Convert component, integration, and E2E fixtures/expectations to the
       document-only contract and retain explicit rejection of legacy `body`.
4. [x] Update ADR/product/data/testing documentation, run canonical and focused
       checks, self-review the final diff, and prepare the PR handoff.

## Progress

- 2026-09-07 JST — Read #502 and dependencies #479/#487/#499/#501; inspected
  governance, execution/testing protocols, ADR 0015/0017, Slide contract,
  current worktrees, and document/body call sites. Created isolated worktree
  and acquired the Issue writer lease.
- 2026-09-07 JST — Removed the compatibility field and fallback from domain,
  repository, editor/detail/preview/audience/projection, converted fixtures, and
  updated ADR/product/data/testing/security documentation.
- 2026-09-07 JST — Verified 539 unit tests, 124 component tests, 141 integration
  tests, Chromium E2E 35/35, production build/config checks, and security audit.

## Decisions

- 2026-09-07 — Decision: make `document` required for text domain/API records
  and remove flattened text from audience application state.
  - Reason: all persisted text rows now have a strict document, and forwarding a
    second representation would retain the duplication this Issue removes.
  - Alternatives: keeping optional document/body fallback was rejected because
    compatibility is explicitly out of scope.
  - ADR: update ADR 0017.

## Risks and mitigations

- Risk: an unvalidated document reaches rendering after the fallback is removed.
  - Mitigation: parse at API/domain and repository read boundaries, with invalid
    persisted/API document tests.
- Risk: text/image switching or audience clearing regresses while union shapes
  change.
  - Mitigation: focused repository, component, integration, and E2E coverage.

## Verification

- [x] `git diff --check` — passed
- [x] `pnpm check` — format, lint, typecheck, 539 unit, 124 component,
      configuration checks, and production build passed
- [x] `pnpm test:integration` — 26 files / 141 tests passed
- [x] `pnpm test:e2e` — Chromium 35/35 passed
- [x] `pnpm security:check` — no high/critical finding; 356 licenses approved
- [x] Acceptance criteria mapped to focused tests and repository search
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, tests, documentation, local canonical verification,
  and self-review.
- Remaining: PR exact-head CI.
- Blocker: none.
- Resume with: inspect required checks on the PR head.

## Result

Text Slides now accept, persist, return, edit, preview, and project only the
strict version 2 document. Image Slide records omit the former null field. Local
canonical, integration, E2E, and security checks pass; required PR exact-head CI
remains the merge gate.
