# Autonomous development governance

## Purpose

Levi is developed primarily by coding agents. Humans are not expected to write
application code, but they retain responsibility for product direction, risk,
access, cost, and production releases.

This document defines what an agent may do autonomously, what requires human
approval, and what evidence is required before work is complete. Instructions in
an Issue or plan may narrow these permissions, but may not expand the approval
boundaries defined here.

## Core principles

1. Work toward a verifiable outcome, not merely a code change.
2. Prefer reversible, repository-scoped actions.
3. Treat tests, static analysis, builds, and runtime checks as the source of
   truth for implementation quality.
4. Keep product decisions, durable constraints, and acceptance criteria in the
   repository or GitHub Issues rather than only in a chat transcript.
5. Use one writer per Issue and worktree. Parallel work must use separate
   branches and non-overlapping scopes.
6. Stop before destructive, production, externally visible, costly, or
   scope-expanding actions unless a human has approved the specific action.
7. Never trade away security, data integrity, or required verification to keep
   an autonomous run moving.

## Request types and authority

### Answer, explain, review, diagnose, or plan

The agent may read repository files, inspect Git history and logs, run
non-mutating diagnostics, and report findings. It must not implement changes
unless the request or assigned Issue also asks for implementation.

### Change, build, fix, or migrate

The agent may make in-scope repository changes and run the non-destructive
validation needed to prove them. It may create a branch, commit, push, open a
draft or ready pull request, respond to review findings, and merge when the
repository's required checks and merge policy permit it.

### Release, production, or external operation

The agent may prepare plans, artifacts, dry runs, and rollback procedures. It
must obtain human approval immediately before the production or external action
listed in the approval boundaries below.

## Actions allowed without additional approval

Within an assigned Issue and an isolated development environment, an agent may:

- Read, search, create, and edit files inside this repository.
- Install dependencies declared by the project and use the checked-in lockfile.
- Run formatters, linters, type checks, tests, development servers, production
  builds, and local browser checks.
- Start, reset, seed, and remove disposable development or test services and
  databases that are clearly identified as non-production.
- Generate and inspect database migrations without applying them to production.
- Create issue-scoped branches and worktrees.
- Commit and push changes to the issue-scoped branch.
- Create and update pull requests for the assigned work.
- Download public documentation or packages needed for the task, subject to the
  project's dependency and license policy.
- Add or update tests, fixtures, documentation, and generated artifacts required
  by the change.
- Retry transient, non-destructive operations within documented retry limits.

Examples include running `pnpm check`, recreating a Dockerized test database,
capturing a Playwright trace, or pushing `codex/issue-123`.

## Actions that always require human approval

An agent must stop and request approval before it performs any of the following:

- Deploying or promoting a release to production.
- Applying a migration to a production database.
- Creating, modifying, or deleting production data.
- Deleting non-disposable data, branches used by others, cloud resources,
  environments, backups, repositories, or accounts.
- Rotating, creating, transmitting, or changing access to secrets, credentials,
  API keys, signing keys, or production tokens.
- Changing repository, organization, cloud, database, or third-party access
  permissions.
- Starting a paid service, purchase, subscription, or operation with a material
  or unbounded cost.
- Publishing information or changing the external visibility of code, data,
  artifacts, documentation, or services.
- Sending messages, filing reports, or otherwise representing a human or the
  organization outside the explicitly assigned GitHub workflow.
- Making an irreversible compatibility break or materially expanding product or
  architecture scope beyond the assigned Issue.
- Using real personal, confidential, pastoral, financial, authentication, or
  production data in development, tests, prompts, logs, or artifacts.
- Disabling required security controls, branch protection, auditability, or
  quality gates.

Approval must identify the exact action, target environment, relevant data, and
expected impact. A broad instruction to "finish everything" is not approval for
an unknown future production or destructive action.

## Human decisions

Humans retain final authority for:

- Product priorities, user experience, supported workflows, and scope.
- Acceptance of material architecture trade-offs and long-term vendor choices.
- Production release timing and rollback decisions.
- Security risk acceptance, privacy, legal, licensing, and compliance decisions.
- Access grants, secrets, budgets, and external service contracts.
- Destructive data-retention or compatibility decisions.

An agent should make and document ordinary implementation decisions when they
are reversible and consistent with accepted ADRs. It should ask only when an
ambiguity would materially change the outcome, risk, cost, or product behavior.

## Credential and data handling

- Production credentials must never be stored in this repository or made
  available to the normal agent development environment.
- Development and CI credentials must be least-privileged, environment-specific,
  revocable, and provided through an approved secret store.
- Secrets must not appear in prompts, Issue bodies, pull requests, logs, test
  reports, screenshots, traces, fixtures, or generated artifacts.
- Tests and migration rehearsals must use synthetic or approved anonymized data.
- Agent jobs that generate code should be separated from jobs that hold GitHub
  write permissions whenever practical.
- Local model-provider login state must remain outside the repository and CI;
  GitHub Actions must not invoke a model provider.

If sensitive data may have been exposed, stop work, avoid copying the value
again, preserve only non-sensitive evidence, and notify a human.

## Destructive and external changes

Before any approved destructive or external change, the executing workflow must
record:

1. The exact target and environment.
2. The expected impact and affected data.
3. A backup, rollback, or forward-recovery plan.
4. The validation performed before execution.
5. The human approval authorizing that specific action.
6. The post-action verification and observed result.

Local development cleanup is exempt only when the target is explicitly resolved
and disposable. An agent must not use a broad or unresolved path, wildcard,
environment variable, database connection, or cloud selector for deletion.

## Definition of Done

Work is complete only when all applicable conditions below are met:

- The Issue outcome and every acceptance criterion are satisfied.
- The implementation stays within scope and documented non-goals.
- Required code, tests, migrations, generated artifacts, and documentation are
  updated together.
- The canonical formatter, linter, type checker, tests, migration checks,
  production build, and relevant end-to-end checks pass.
- New or changed behavior has automated regression coverage at the lowest useful
  test level.
- Database changes have been reviewed for data loss, locking, rollback or
  forward recovery, and compatibility.
- Authentication and authorization changes test both allowed and denied cases.
- The final diff has been reviewed for unrelated changes, secrets, unsafe
  defaults, missing error handling, and architecture violations.
- The pull request records the commands run, their results, remaining risks, and
  any deliberately deferred work.
- Required CI checks pass on the exact commit to be merged.
- No unresolved blocker is represented as completed work.

A generated file, a successful command from an earlier commit, or an agent's
statement that the task is complete is not sufficient evidence by itself.

## Evidence standards

Verification evidence should be concise and reproducible. A pull request should
include, when applicable:

- Exact command names and pass/fail results.
- Test report, screenshot, trace, migration report, or artifact links.
- The commit SHA on which the checks ran.
- Manual verification steps only when automation is not yet practical.
- Known limitations, residual risks, and follow-up Issue links.

If a check cannot run, the agent must state why, identify the risk, and leave the
work open or blocked unless the Issue explicitly defines an acceptable
alternative.

## Failure, blocking, and escalation

The agent should retry only transient failures and use bounded retries. It must
not treat authentication errors, permission denials, policy blocks, failing
tests, or unclear product decisions as provider availability failures.

When blocked, record:

- The intended outcome.
- Work already completed.
- The exact blocking condition and evidence.
- Safe alternatives already attempted.
- The smallest decision or access change needed from a human.

## Updating this policy

Change this policy through a dedicated pull request. Explain the observed
failure or operational need that motivates the change. Permission expansions,
production authority, data handling, or approval-boundary changes require human
approval even if the pull request passes all automated checks.
