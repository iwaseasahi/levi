# Levi

Levi is the replacement for Ginmaku 2, a web-based worship presentation system.
The repository is being built with coding agents as the primary implementers and
with reproducible validation as the basis for accepting changes.

## Requirements

- Node.js 24.19.0 (see `.node-version`)
- pnpm 11.19.0 (see `package.json`)
- Docker with Compose (for local PostgreSQL)

Use a version manager that reads `.node-version`, then enable or install the
pinned pnpm release. Do not substitute npm or regenerate the pnpm lockfile with a
different package manager.

## Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open <http://localhost:3000> for the application shell and
<http://localhost:3000/api/health> for the process health endpoint, and
<http://localhost:3000/api/health/database> for database connectivity.

## Canonical commands

```bash
pnpm dev          # development server
pnpm format:check # formatting verification
pnpm lint         # ESLint
pnpm typecheck    # Next.js route types and TypeScript
pnpm test         # unit and component tests
pnpm build        # production build
pnpm check        # all currently available required checks
pnpm db:up        # start development and test PostgreSQL instances
pnpm db:check     # migrate, detect drift, seed, and query the configured DB
pnpm db:down      # stop the local PostgreSQL instances
```

Install the pinned Chromium build once with `pnpm test:e2e:install`. Run database
integration tests with `pnpm test:integration` and the browser walking skeleton
with `pnpm test:e2e`. See [`docs/testing.md`](docs/testing.md) for isolation,
artifacts, coverage, and flake policy.

Pull requests run the same commands in GitHub Actions. See
[`docs/ci.md`](docs/ci.md) for required checks, artifacts, and branch protection.

## Database workflow

The development database listens only on `127.0.0.1:55432`; the ephemeral test
database listens on `127.0.0.1:55433`. Migration history and the Prisma schema
must agree before merge:

```bash
pnpm db:migrate:dev # create a migration while developing a schema change
pnpm db:check       # rehearse committed migrations and verify deterministic seed
```

To rehearse from the previous schema, restore a representative synthetic backup
to the test database, point `DATABASE_URL` and `SHADOW_DATABASE_URL` at the test
instance, then run `pnpm db:check`. On a new empty test instance the same command
replays the complete migration history.

`pnpm db:reset` is destructive and fails unless the URL names the local `levi` or
`levi_test` database on a loopback host. Prisma may additionally require explicit
human consent when an AI agent invokes a reset. Never bypass that safeguard.

## Agent documentation

- [`AGENTS.md`](AGENTS.md): repository instructions loaded by Codex.
- [`PLANS.md`](PLANS.md): execution-plan rules and template.
- [`docs/governance/autonomy.md`](docs/governance/autonomy.md): permissions,
  approval boundaries, and Definition of Done.

## Verify instruction discovery

Start a fresh Codex session from the repository root and ask:

```text
List the repository instruction files you loaded, summarize the autonomous
approval boundaries, and list canonical commands that are currently available.
Do not modify files.
```

The response must identify the root `AGENTS.md`, reference the governance policy,
and list the canonical pnpm commands above. Codex rebuilds the instruction chain
at the start of a run, so use a new session after changing instruction files.

## Contributing workflow

Work from a GitHub Issue in an issue-specific branch and worktree. Record the
commands and results used to verify the change in its pull request. Do not put
production credentials or real production data in the repository or agent
context.
