# Simplify Slides to one projected page

- Issue #424; user-directed simplification of the completed #59 Slide feature.
- Branch `codex/issue-424`; no schema, migration or production operation.

## Plan

1. [x] Inspect the legacy-derived delimiter, preview, controller, audience and
       acceptance coverage.
2. [x] Replace four-LF parsing with one normalized body and remove preview page
       navigation, projection previous/next controls and projection page selection.
3. [x] Update the product contract and executable evidence so embedded newlines
       remain literal content while Open, font sizing and blanking continue to work.
4. [ ] Run canonical validation, review the final diff, open a PR, verify exact
       head CI and merge.

## Decisions

- This deliberately departs from pinned Ginmaku page splitting. The historical
  evidence remains recorded, while the active replacement rule becomes a single
  projected body.
- Shared projection actions remain available for Scripture. Slide presentation
  keeps the existing authorization, revision, font and blank lifecycle with one
  internal page at index zero.

## Progress

- The delimiter and outline functions are removed. Preview and audience render
  the normalized body intact, including four or more consecutive newlines.
- Slide controller/audience page buttons, selectors, counters, query coordinate
  and arrow-key navigation are removed. Scripture navigation remains enabled.
- Local validation passed: 446 unit tests, 94 component tests, 33 Chromium E2E,
  formatting, lint, types, production build and `git diff --check`.
