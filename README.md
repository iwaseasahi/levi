# Levi

Levi is the replacement for Ginmaku 2, a web-based worship presentation system.
The repository is being built with coding agents as the primary implementers and
with reproducible validation as the basis for accepting changes.

## Current status

The repository is in its foundation phase. Application and package-manager
scaffolding have not been added yet. Follow the child Issues under
[foundation Issue #1](https://github.com/iwaseasahi/levi/issues/1) for progress.

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
and distinguish `git diff --check` from the planned but not-yet-implemented pnpm
commands. Codex rebuilds the instruction chain at the start of a run, so use a
new session after changing instruction files.

## Contributing workflow

Work from a GitHub Issue in an issue-specific branch and worktree. Record the
commands and results used to verify the change in its pull request. Do not put
production credentials or real production data in the repository or agent
context.
