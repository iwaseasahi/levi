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
