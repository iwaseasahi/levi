# ADR 0001: Use Next.js App Router, React, and strict TypeScript

- Status: accepted
- Date: 2026-08-21
- Decision owners: repository owner and architecture maintainers
- Supersedes: none
- Superseded by: none

## Context

Levi replaces a web-based worship presentation system and will be implemented
and maintained primarily by coding agents. The application needs a browser UI,
server-side capabilities, strong automated feedback, and as few language and API
boundaries as practical.

Next.js App Router provides a full-stack React model using Server and Client
Components, file-system routing, and production build tooling. Current Next.js
packages also include version-matched documentation that agents can inspect
locally, reducing reliance on stale framework knowledge.

Static typing is valuable only if it is enforced. The repository therefore
requires strict TypeScript and must not bypass type errors during production
builds.

## Decision

Use Next.js App Router with React as Levi's initial web application framework.
Use TypeScript for application, server, tooling, and test code with strict mode
enabled.

Prefer one deployable full-stack application until measured requirements justify
separating services. Keep domain rules independent of React and Next.js where
practical so framework concerns remain replaceable.

Agents performing Next.js work must consult the documentation bundled with the
installed `next` package before relying on remembered APIs.

## Consequences

### Positive

- UI and server changes share one language, compiler, package graph, and test
  toolchain.
- TypeScript provides fast feedback before runtime.
- App Router supports server-rendered and interactive presentation workflows.
- Version-matched local documentation improves agent implementation accuracy.

### Negative and risks

- Server/Client boundaries, caching, and rendering behavior require explicit
  conventions and tests.
- Framework upgrades may change routing or data-fetching behavior.
- A single full-stack deployment can become tightly coupled if domain and
  infrastructure boundaries are not enforced.
- Browser-based presentation requirements may later require additional offline
  or native capabilities.

## Alternatives considered

### Django with a separate React frontend

Django offers a mature ORM, authentication system, and admin interface. It was
not selected because the initial architecture would add a Python/TypeScript and
HTTP contract boundary for most cross-cutting changes. Reconsider it if backend
administration or Python-specific workloads become dominant.

### React SPA with a separate API

This offers clear deployment separation but creates an API boundary before the
product demonstrates a need for it. Reconsider when independent scaling,
external API consumers, or organizational ownership require separate services.

## Compatibility and version policy

- Select a generally available Next.js release supported by its current upgrade
  documentation; do not build production on a canary release.
- Select an Active LTS Node.js release that is also supported by Prisma.
- Pin Node.js, pnpm, Next.js, React, and TypeScript in repository-controlled
  files and commit the lockfile.
- Upgrade deliberately through a pull request that runs the full quality gate
  and reviews framework migration guidance.

## Reconsider when

- Required presentation behavior cannot meet measured reliability, latency, or
  offline requirements in the browser.
- Independent services or non-TypeScript workloads become a demonstrated need.
- Framework coupling repeatedly prevents domain-level testing or safe upgrades.

## Verification

- A production build succeeds with strict type checking enabled.
- A walking skeleton covers server rendering, client interaction, and browser
  end-to-end validation.
- Architecture checks prevent domain code from depending on UI modules.

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript)
- [Next.js guide for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents)

