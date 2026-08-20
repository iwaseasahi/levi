# Levi agent instructions

## Mission

Levi is the replacement for Ginmaku 2. Coding agents perform implementation,
testing, review, and maintenance; humans retain the decisions and approvals
defined in [`docs/governance/autonomy.md`](docs/governance/autonomy.md).

## Start every task

1. Read the assigned GitHub Issue and its parent or dependency Issues.
2. Read this file, the governance policy, and relevant ADRs and product docs.
3. Inspect the repository before assuming a command, dependency, or pattern
   exists.
4. For multi-step work, create or update an execution plan using `PLANS.md`.
5. Work on one Issue in one dedicated branch/worktree.

## Repository layout

- `docs/governance/`: autonomy, approvals, and Definition of Done.
- `docs/architecture/`: architecture index and ADRs (introduced by Issue #5).
- `docs/product/`: product scope and glossary (introduced by Issue #5).
- `docs/migration/`: Ginmaku 2 parity and migration evidence (Issue #11).
- Application, database, and test directories do not exist yet. Update this
  section when their scaffolding is merged.

## Canonical commands

The application toolchain has not been scaffolded yet. At this stage, use:

- `git diff --check`: validate whitespace and patch formatting.

The following commands are planned but **not available yet**. Do not report them
as executed until the corresponding package scripts exist:

- `pnpm install --frozen-lockfile`
- `pnpm dev`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm build`
- `pnpm check`

When adding the toolchain, make these scripts the single source of truth for
local and CI verification, then replace this planned list with exact commands.

## Engineering rules

- Follow accepted ADRs. If none covers a material choice, write or update an ADR
  before committing to the choice.
- Keep framework code at the edges and domain rules independent where practical.
- Do not introduce a production dependency without documenting why the standard
  library or an existing dependency is insufficient.
- Pin runtime and package-manager versions and commit the lockfile.
- Treat database migrations, authentication, authorization, external I/O, and
  data deletion as high-risk changes requiring focused tests and review.
- Never put real production data or secrets in code, fixtures, prompts, logs,
  screenshots, traces, Issues, or pull requests.
- Fix root causes. Do not weaken types, tests, lint rules, or security controls to
  make a check pass.
- Keep changes scoped to the assigned Issue. Record unrelated findings in a
  follow-up Issue.

## Git and pull requests

- Branches created by Codex use `codex/issue-<number>`.
- Make commits focused and explain the outcome, not the editing process.
- Do not rewrite shared history or force-push unless a human explicitly approves
  the exact branch and reason.
- A pull request must link its Issue and include summary, verification evidence,
  risks, migrations, and follow-up work.
- Do not merge if required checks are missing, stale, or failing.
- One active writer owns an Issue/worktree. Parallel work uses separate scopes
  and worktrees.

## Definition of Done

The authoritative Definition of Done is in
[`docs/governance/autonomy.md`](docs/governance/autonomy.md#definition-of-done).
Before declaring completion, verify every applicable item and record the exact
commands and results in the pull request. If a canonical check does not exist
yet, state that fact and use the strongest available validation.

## Plans and decisions

- Use `PLANS.md` for work that spans multiple meaningful steps, has dependencies,
  or may be handed to another agent.
- Keep the plan current while working; do not rewrite history to hide deviations.
- Record durable architecture decisions as ADRs, not only in execution plans.
- Record blocked work with evidence and the smallest decision needed to resume.

## Instruction layering

Add a nested `AGENTS.md` only when a subtree has commands or constraints that do
not apply to the rest of the repository. Keep repository-wide rules here and
link to detailed documents instead of copying them. A nested file may specialize
these instructions but must not relax governance or approval boundaries.

When the same agent mistake occurs repeatedly, add the narrowest enforceable
guard: test or static check first, then instruction, skill, or hook as appropriate.

