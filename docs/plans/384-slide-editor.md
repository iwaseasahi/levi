# Church slide editor and unsaved preview

## Issue

- Issue: #384, parent #59; dependencies #382, #383, #394 (merged).
- Branch: `codex/issue-384`
- Base commit: `6120741`

## Outcome

Eligible church members can create, read, edit, explicitly preview unsaved body,
and confirm physical deletion through the scoped API delivered by #394.

## Context and constraints

- Follow ADR 0015, `docs/product/slide-contract.md`, governance and testing policy.
- Installed Next.js 16.3.1 page/route/client documentation inspected.
- No new dependencies, schema changes, production access, or content logging.
- Preview parses body only, preserves literal text and uses a reusable 16:9 fit
  surface. Title/author remain outside the surface. Native editor keys remain native.
- Search/list (#385) and projection (#386/#387) follow separately. `/slides` is
  initially a valid creation entry point, not a claim of delivered search.

## Plan

1. [ ] Add authenticated pages, API loading, editor and explicit body preview.
2. [ ] Cover loading/retry, validation, failure retention, conflict, disabled
       mutation, deletion cancellation/focus and success with component tests.
3. [ ] Verify real CRUD, literal preview, 390/1280 layouts and accessibility in Chrome.
4. [ ] Run canonical checks, review final diff, open PR and merge exact green head.

## Progress

- 2026-08-31 JST — API split #394 merged in #395; resumed UI work on current main.

## Risks and mitigations

- Concurrent edits: retain draft and explain HTTP 409, never silently reload it.
- Protected content: no-store API, discard late loads after unmount/route change.
- Long text: measured text fit and browser geometry assertions on synthetic text.

## Verification

- Pending component, E2E, check, security and final review evidence.

## Handoff or blockers

- Blocker: none. Implementation and verification in progress.
