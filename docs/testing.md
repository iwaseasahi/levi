# Testing strategy

Levi uses separate feedback loops so failures identify the responsible layer.

| Layer       | Command                   | Responsibility                               |
| ----------- | ------------------------- | -------------------------------------------- |
| Unit        | `pnpm test:unit`          | Pure logic and configuration boundaries      |
| Component   | `pnpm test:component`     | Rendered behavior and basic accessibility    |
| Integration | `pnpm test:integration`   | Prisma/PostgreSQL behavior and constraints   |
| E2E         | `pnpm test:e2e`           | Browser walking skeleton and runtime errors  |
| Coverage    | `pnpm test:unit:coverage` | Enforced unit coverage and HTML/JSON reports |

Integration tests use the ephemeral PostgreSQL service on port 55433. Each test
owns records with a `test.` key and removes that namespace after execution.
Factories generate unique identifiers; tests must never rely on execution order,
shared mutable fixtures, or production-derived data.

Playwright treats `console.error`, uncaught page errors, unhandled browser
rejections, and hydration errors as failures. Failed E2E tests retain a trace,
screenshot, and video in `test-results/`; an HTML report is written to
`playwright-report/`. Vitest writes JUnit reports to `test-results/`.

## Flake policy

- Retries are zero. A retry must never be used to turn a nondeterministic test
  green.
- Reproduce a flake locally, retain its artifact, and fix the synchronization,
  isolation, clock, random-data, or environment cause.
- Quarantine requires a linked Issue, owner, reason, and expiry date. A skipped
  test without all four is a failing review condition.
- Prefer role-based browser locators and observable outcomes over timeouts.

Before changing a gate, prove that it fails for the defect it claims to detect.
Temporary intentional failures used for that proof must not be committed.
Tests that intentionally provoke a browser resource error must register its
exact console message through `pageErrorGuard.allowConsoleError`. The exception
is local to that test and does not suppress other console or page errors.

The initial-release latest-Chrome behavior and its secret-bearing artifact
boundary are mapped in
[`docs/testing-initial-release-e2e.md`](testing-initial-release-e2e.md).

## Unit coverage scope

Unit coverage includes every production TypeScript file under `domain`,
`application`, `config`, and API `controller` boundaries, even when a test does
not import the file. Agent orchestration, readiness, request logging, and the
request proxy remain included because they also contain unit-testable policy.

The following code is intentionally outside unit coverage:

| Code                                              | Reason                                                                               | Owning gate                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| React components and App Router pages/layouts     | Behavior depends on rendering, hydration, or routing                                 | Component and E2E                                                                         |
| API `route.ts` adapters other than readiness      | Thin framework adapters delegate to covered controllers                              | Controller unit tests and E2E                                                             |
| Prisma repositories and database client/readiness | Behavior depends on PostgreSQL constraints and transactions                          | Integration                                                                               |
| Auth client/server adapters                       | Behavior depends on Better Auth and request/session integration                      | Integration and E2E                                                                       |
| Migration and operational scripts                 | File/database/process behavior has dedicated suites and destructive-operation guards | Unit or integration tests colocated with each script, outside the product-code percentage |
| Type-only `agent-orchestration/types.ts`          | Erased at runtime; there are no executable statements                                | Typecheck                                                                                 |

Thresholds apply to the combined unit-testable scope and must not be weakened to
make a change pass.

## Client request concurrency

Client components accept an injected `fetch` implementation for deterministic
tests and treat it as fixed for the component lifetime. Protected reads use
`cache: "no-store"`; JSON success and API error parsing use the shared typed
client helper.

Scripture catalog requests use a monotonically increasing sequence and discard
stale responses. Audience navigation is serialized through its existing promise
queue so rapid previous/next commands cannot commit out of order. These guards
remain authoritative for the current small same-origin requests; introduce
`AbortController` only when a component owns cleanup for the complete request
lifecycle, and retain the sequence/queue guard for responses that may already
have completed.

## Initial behavior responsibility map

This table fixes the observable behavior that must survive structural refactors.

| Flow                             | UI / route boundary                                       | Application and domain responsibility                       | Characterization gate             |
| -------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| Login and persistent session     | `/login`, `/api/auth/[...all]`, request proxy             | auth options, church access, session eligibility            | unit, integration, E2E            |
| Scripture search                 | `/scripture`, scripture catalog/search API controllers    | catalog lookup, range validation, bilingual search          | unit, component, integration, E2E |
| Audience projection and controls | `/scripture/audience`, direct audience component          | audience message validation and scripture navigation        | unit, component, E2E              |
| Folders and bookmarks            | saved-content panel, `/folders`, saved-content controller | tenant-scoped folder/bookmark commands and ordering         | unit, component, integration, E2E |
| Temporary-password change/reset  | `/change-password`, operator administration               | password lifecycle, forced-change state, session revocation | unit, component, integration, E2E |
| Tenant isolation                 | request proxy and church-scoped APIs                      | membership eligibility and church-scoped repositories       | unit, integration, E2E            |
