# Establish provider-neutral agent orchestration

## Issue

- Issue: #2
- Branch: `codex/issue-2`
- Base commit: `b82094de5a795253fd0b563cc00269c86b660966`

## Outcome

Codex and Claude Code can share repository instructions, classify availability
failures, checkpoint work, enforce single-writer ownership, and pass a patch
through the same quality gates without sharing provider credentials.

## Context

- `AGENTS.md` and `docs/governance/agent-execution-protocol.md` define current
  agent behavior.
- GitHub protects `Quality`, `Database`, `E2E`, and `Security`.
- Official CLIs provide non-interactive structured output; local versions at
  start were Codex 0.148.0 and Claude Code 2.1.228.

## Constraints

- Provider jobs have read-only GitHub access and only their own credential.
- Agent-generated code cannot receive production credentials or bypass CI.
- Provider-backed rehearsal requires owner-approved sandbox credentials and can
  incur external usage; repository implementation and synthetic tests do not.

## Non-goals

- Production deployment or migration.
- Simultaneous writers in one branch/worktree.
- Automatic fallback for authentication, policy, test, or infrastructure errors.

## Plan

1. [x] Make repository instructions and schemas provider-neutral.
2. [x] Implement tested classification, retry, routing, lease, and checkpoint primitives.
3. [x] Define credential-separated GitHub orchestration and cross-review.
4. [ ] Run a provider-backed sample after approved secrets are configured.
5. [ ] Merge after required CI and record the rollout boundary.

## Progress

- 2026-08-21 05:41 JST — Started from protected `main`; inspected Issue #2,
  governance, CI, and installed CLI help.
- 2026-08-21 05:46 JST — Unit tests passed for classifier, command adapters,
  bounded retry, checkpoint integrity, and writer lease; fixture route selected
  fallback after three synthetic 429 attempts.
- 2026-08-21 05:54 JST — `pnpm check`, 80% coverage gates, dependency/license
  checks, PostgreSQL integration tests including the router fixture, and Chromium
  E2E passed. Actionlint 1.7.12 accepted both workflows.

## Decisions

- 2026-08-21 — Keep provider adapters thin and the router deterministic.
  - Reason: failure policy and handoff evidence must be testable without paid
    provider calls.
  - Alternatives: provider-specific workflows with duplicated policy.
- 2026-08-21 — Manual `workflow_dispatch` is the only initial trigger.
  - Reason: untrusted public Issue/PR content must not automatically execute an
    agent or consume budget.

## Risks and mitigations

- Risk: provider error text changes and causes misclassification.
  - Mitigation: conservative fallback allowlist, normalized artifacts, fixture
    tests, and a stop-by-default unknown status.
- Risk: generated code obtains a write token.
  - Mitigation: generation/review/quality jobs are read-only; publishing is a
    separate provider-secret-free job.

## Verification

- [x] `pnpm test:unit` — orchestration tests pass.
- [x] Synthetic rate-limit fixture — routes to Claude fallback.
- [x] `pnpm check`, coverage, integration, E2E, and security.
- [ ] Required GitHub checks on the exact PR head.
- [ ] Provider-backed sample Issue after credential approval.

## Handoff or blockers

- Completed: repository-side provider-neutral primitives and contracts.
- Remaining: final workflow verification, PR/CI, credential-backed rollout.
- Blocker: live provider rehearsal requires approved OpenAI and Anthropic
  sandbox credentials; repository secrets cannot be changed autonomously.
- Resume with: configure both approved repository secrets, then dispatch the
  orchestration workflow against a synthetic sample Issue.
