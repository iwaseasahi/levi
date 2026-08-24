# Levi

Levi is the replacement for Ginmaku 2, a web-based worship presentation system.
The repository is being built with coding agents as the primary implementers and
with reproducible validation as the basis for accepting changes.

## Requirements

- [mise](https://mise.jdx.dev/) (Node.js 24.19.0 is pinned in `mise.toml`)
- pnpm 11.19.0 (see `package.json`)
- Docker with Compose (for local PostgreSQL)

Local PostgreSQL is defined in `compose.development.yaml`. Production uses the
separate `deploy/production/compose.yaml`, `Dockerfile.production`, and
`Dockerfile.migrate.production`; the production definitions are not used by
the normal `mise run dev` workflow.

`mise install` prepares the pinned Node.js release. Corepack then uses the pnpm
release declared by `packageManager`; do not substitute npm or regenerate the
lockfile with a different package manager. `.node-version` remains synchronized
for compatible tools.

## Setup

```bash
mise install
mise run setup
mise run dev
```

`mise run setup` installs locked dependencies, creates `.env` when absent (or
adds only missing `.env.example` keys without replacing existing values), starts
only the development PostgreSQL service, generates the Prisma Client, applies
migrations, and runs the deterministic seed. It is safe to run again and does
not reset the database. The fixed local Compose project name also lets repository
worktrees reuse this development database instead of competing for its port.

Open <http://localhost:3000> for the application shell and
<http://localhost:3000/api/health> for process liveness,
<http://localhost:3000/api/ready> for traffic readiness, and
<http://localhost:3000/api/health/database> for focused database diagnostics.
From another terminal, verify all three endpoints and then stop the development
database when finished:

```bash
mise run smoke
mise run stop
```

`mise run stop` preserves the development database volume. The existing
`pnpm db:down` command still stops both development and test services.

Run the canonical local quality suite with `mise run check`. The production
build portion uses a synthetic HTTPS auth origin because production-mode auth
validation intentionally rejects the HTTP origin used by `mise run dev`.

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
pnpm db:up:dev    # start only the development PostgreSQL instance
pnpm db:check     # migrate, detect drift, seed, and query the configured DB
pnpm db:down      # stop the local PostgreSQL instances
pnpm security:check  # production dependency and license gates
pnpm backup:rehearse # local disposable backup/restore proof
pnpm release:checklist:dry-run # validate and print the gated synthetic cutover walkthrough
pnpm agent:checkpoint        # save a local Codex pause/resume checkpoint
pnpm agent:checkpoint:verify # verify a saved checkpoint
pnpm agent:lease             # acquire or release an Issue writer lease
```

Install the pinned Chromium build once with `pnpm test:e2e:install`. Run database
integration tests with `pnpm test:integration` and the browser walking skeleton
with `pnpm test:e2e`. See [`docs/testing.md`](docs/testing.md) for isolation,
artifacts, coverage, and flake policy.

Pull requests run the same commands in GitHub Actions. See
[`docs/ci.md`](docs/ci.md) for required checks, artifacts, and branch protection.
Codex is the sole coding agent and runs locally with ChatGPT subscription login;
GitHub Actions never invokes a model provider. Setup, pause/resume, and review
are described in
[`docs/local-agent-development.md`](docs/local-agent-development.md) and
[`docs/agent-protocol.md`](docs/agent-protocol.md).

Security and operations start at [`docs/security/threat-model.md`](docs/security/threat-model.md)
and [`docs/operations/observability.md`](docs/operations/observability.md).

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
- [`docs/governance/agent-execution-protocol.md`](docs/governance/agent-execution-protocol.md):
  Issue readiness, execution, PR sizing, and handoff protocol.
- [`docs/governance/foundation-completion.md`](docs/governance/foundation-completion.md):
  evidence that the autonomous development foundation satisfies Issue #1.
- [`docs/migration/README.md`](docs/migration/README.md): pinned Ginmaku evidence,
  parity matrix, migration rehearsal, and vertical-slice selection.

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
