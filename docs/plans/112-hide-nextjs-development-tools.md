# Hide Next.js development tools from Levi screens

## Issue

- Issue: #112
- Branch: `codex/issue-112`
- Base commit: `044152823c721bb9c1e3b0f5f318558c299015c4`

## Outcome

Local development pages no longer render the Next.js development indicator or
its settings panel, so application validation messages remain unobstructed.

## Context

- `next.config.ts` configures the repository's Next.js 16.3.1 runtime.
- The version-matched `devIndicators` documentation specifies
  `devIndicators: false` as the supported way to hide the indicator while
  retaining compile and runtime error reporting.
- `scripts/check-local-development.ts` is part of `pnpm check` and guards the
  repository's local-development contract.

## Constraints

- Do not hide the indicator with application CSS or DOM manipulation.
- Do not suppress Next.js compile or runtime errors.
- Do not change scripture search, projection, authentication, or production
  behavior.
- Merge only after the protected Quality, Database, E2E, and Security jobs pass
  on the exact pull-request head.

## Non-goals

- Changing the placement or appearance of application validation messages.
- Changing Next.js error overlays.

## Plan

1. [x] Confirm the Next.js 16.3.1 configuration contract and Issue criteria.
2. [x] Disable the development indicator and guard the setting in the local
       configuration check.
3. [x] Run focused, canonical, database, integration, E2E, security, and browser
       verification.
4. [ ] Review the complete diff, open a pull request, pass exact-head protected
       CI, merge, and close the Issue.

## Progress

- 2026-08-22 10:49 JST — Started from `origin/main`; read Issue #112,
  governance, testing guidance, and the bundled Next.js `devIndicators`
  documentation.
- 2026-08-22 10:49 JST — Configured `devIndicators: false` and added a
  `local:config:check` regression assertion.
- 2026-08-22 10:54 JST — Passed local configuration, canonical, database,
  integration (72 tests), latest-Chromium E2E (9 tests), security, and whitespace
  checks. In a live development page, the Next.js N button and its Route Info,
  Bundler, and Preferences panel were absent while the application rendered.

## Decisions

- 2026-08-22 — Decision: disable the indicator through `next.config.ts`.
  - Reason: this is the documented framework control and leaves framework error
    reporting enabled.
  - Alternatives: CSS or DOM suppression was rejected because it depends on
    private Next.js markup and would leave the panel active but hidden.
  - ADR: not required; this is a reversible development-only framework setting.

## Risks and mitigations

- Risk: a later configuration edit silently restores the overlay.
  - Mitigation: import the actual Next.js configuration in
    `local:config:check` and assert that the option remains `false`.
- Risk: hiding the indicator also hides useful failures.
  - Mitigation: use the documented option, which explicitly retains compile and
    runtime error reporting, and verify the production build.

## Verification

- [x] `mise exec -- pnpm local:config:check`
- [x] `mise exec -- pnpm check`
- [x] database, integration, E2E, and security checks against the disposable
      test database
- [x] latest Chrome local page has no Next.js indicator or settings panel
- [x] `git diff --check`
- [x] final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation, regression assertion, local checks, browser
  verification, and implementation self-review.
- Remaining: pull request, protected exact-head CI, and merge.
- Blocker: none.
- Resume with: commit the verified diff and open the pull request.

## Result

Pending verification and merge.
