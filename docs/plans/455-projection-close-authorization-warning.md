# Suppress authorization warnings while a projection tab closes

## Issue

- Issue: #455
- Branch: `codex/issue-455`
- Base commit: `024102f01fc258b3be1a64f708c532f1df2a33db`

## Outcome

Closing a Scripture or Slide audience tab disables its controller without ever
showing an authorization warning. A live audience that actually loses
authorization still shows the existing warning.

## Context

- `src/app/projection/use-projection-controller.ts` immediately maps an
  unauthorized acknowledgement to a visible error.
- During tab teardown, that acknowledgement can arrive before Chrome updates
  the retained `Window.closed` flag.
- Issue #455 already added a one-cycle close check for heartbeat and
  `postMessage` failures; authorization failure needs the same close grace.

## Constraints

- Keep controls disabled as soon as the acknowledgement becomes unauthorized.
- Preserve warnings for a live unauthorized audience and a live heartbeat
  timeout.
- Keep the v2 transport envelope, audience content, and database unchanged.

## Non-goals

- Changing warning copy or removing actionable warnings from live tabs.
- Changing audience routes or authentication policy.

## Plan

1. [x] Defer the visible authorization warning for one monitoring cycle while
       retaining the acknowledged unauthorized state.
2. [x] Add shared-controller and consuming-screen regression coverage for the
       close race and live authorization loss.
3. [x] Update protocol documentation and run focused and canonical checks.
4. [x] Push a focused PR, wait for required CI, and merge after it passes.

## Progress

- 2026-09-03 JST — Reopened #455 and confirmed the remaining race between an
  unauthorized acknowledgement and delayed `Window.closed` settlement.
- 2026-09-03 JST — Added a one-cycle authorization grace to the shared
  controller, retained immediate control disabling, documented the lifecycle,
  and passed 32 focused component tests plus focused lint and `diff --check`.
- 2026-09-03 JST — `pnpm check` passed with 452 unit and 105 component
  tests plus the production build; `pnpm test:e2e` passed all 33 latest-Chromium
  scenarios; `pnpm security:check` passed its high-severity threshold and license
  inventory (one existing moderate advisory reported).
- 2026-09-03 JST — PR #469 passed Quality, Database, E2E, and Security on
  commit `2b88984`; prepared the final plan record for merge.

## Decisions

- 2026-09-03 — Decision: use the existing one-second controller monitoring
  cycle as a close-settlement grace before rendering the authorization warning.
  - Reason: controls fail closed immediately through acknowledged state, while
    the controller can silently discard a tab that Chrome confirms as closed.
  - Alternatives: suppress every unauthorized warning, which would hide real
    session revocation; change the transport schema, which is unnecessary.
  - ADR: not required; this completes the existing lifecycle behavior.

## Risks and mitigations

- Risk: a real authorization failure warning is delayed briefly.
  - Mitigation: controls disable immediately and a live tab shows the unchanged
    warning after one monitoring cycle.
- Risk: a delayed acknowledgement from an old generation revives the warning.
  - Mitigation: retain existing source, generation, instance, and sequence
    checks and bind pending failure state to the active connection.

## Verification

- [x] Focused projection and screen component tests — 32 passed
- [x] `pnpm check` — passed; 452 unit, 105 component, build and config checks
- [x] Relevant latest-Chromium E2E — full suite, 33 passed
- [x] Required GitHub CI — Quality, Database, E2E, and Security passed
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: root cause confirmed, issue scope updated, controller and regression
  coverage implemented, protocol documented, local checks and required CI passed,
  and PR #469 prepared for merge.
- Remaining: none.
- Blocker: none.
- Resume with: no remaining implementation work.

## Result

PR #469 completes the lifecycle race fix for both Scripture and Slide controllers.
Controls still fail closed immediately, closed audience tabs are silent, and live
authorization loss retains the existing warning after one monitoring cycle.
Local checks and all four required GitHub checks passed without schema or data
changes.
