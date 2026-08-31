# Keep only the slide-list navigation link in the sidebar

- Issue: #408; corrects the agent's interpretation in #406 / #407.
- Branch: `codex/issue-408`; base: `af09fae`.
- User outcome: “フォルダの一覧” followed by “スライドの一覧”, linking to
  `/slides` in the same style. No embedded slide list or create/search controls.

## Plan and progress

1. [x] Read #406 and the user's correction; inspect sidebar and existing styles.
2. [x] Restore standalone SlideList and scripture composition from before #407;
       keep the removed settings entry removed. Add one link using existing style.
3. [x] Update existing E2E to check ordering, equal widths, keyboard navigation,
       accessibility and creation via /slides at 390px/1280px.
4. [x] Run canonical checks and inspect screenshots/diff. Required CI/merge
       outcome is recorded in the PR.

## Boundaries

No schema, DB, authentication, projection or production changes. No added
production dependencies. Removes the extra slide-list read on the scripture page.
Previous missing local migration remains separate and is not applied here.

## Verification

- `pnpm check`: passed (format/lint/typecheck, 438 unit, 92 component,
  configuration checks, production build).
- `pnpm test:e2e`: passed 32 Chromium tests with zero retries after the final
  Link change. Verified 390px/1280px aligned link appearance, placement, focus,
  keyboard navigation to /slides, accessibility and existing CRUD.
- Visually inspected synthetic `slide-sidebar-link-1280.png`; generated both
  narrow/wide screenshots in the Playwright test output.
- Initial lint rejected a new plain anchor; used Next Link with prefetch disabled.
  No rule was relaxed. Final checks passed.
- Separate diff review: removed sidebar rendering/styles/fetcher and its tests;
  five restored files exactly match 217be42. Kept settings removal. One static
  link reuses folder styling. No API, DB, auth or dependency changes.
- `git diff --check`: passed. No secrets or real data included.

No new component tests for this static link; existing slide, folder, scripture
and E2E coverage validate retained functionality and the corrected route.
