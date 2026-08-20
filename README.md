# Levi

Levi is the replacement for Ginmaku 2, a web-based worship presentation system.
The repository is being built with coding agents as the primary implementers and
with reproducible validation as the basis for accepting changes.

## Requirements

- Node.js 24.19.0 (see `.node-version`)
- pnpm 11.19.0 (see `package.json`)

Use a version manager that reads `.node-version`, then enable or install the
pinned pnpm release. Do not substitute npm or regenerate the pnpm lockfile with a
different package manager.

## Setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000> for the application shell and
<http://localhost:3000/api/health> for the health endpoint.

## Canonical commands

```bash
pnpm dev          # development server
pnpm format:check # formatting verification
pnpm lint         # ESLint
pnpm typecheck    # Next.js route types and TypeScript
pnpm build        # production build
pnpm check        # all currently available required checks
```

Test commands are introduced by Issue #8 and are not part of `pnpm check` yet.

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
