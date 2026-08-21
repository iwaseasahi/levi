# Local agent development protocol

This repository is implemented and reviewed with the locally installed Codex
and Claude Code clients. Both clients must use the repository owner's flat-rate
subscription login. Provider APIs and provider API keys are outside the Levi
development path.

This document extends
[`docs/governance/agent-execution-protocol.md`](governance/agent-execution-protocol.md).
The governance policy remains authoritative when rules conflict.

## Cost and credential boundary

- Do not configure or use `OPENAI_API_KEY`, `CODEX_API_KEY`,
  `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` for Levi development.
- Do not route through `OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, Bedrock, Vertex,
  Foundry, an `apiKeyHelper`, `codex login --with-api-key`, or `claude
setup-token`. These are API authentication or billing paths even when the four
  key variables above are unset.
- GitHub Actions verifies repository changes only. It must not invoke Codex,
  Claude Code, or another paid model provider.
- Authenticate each local client through its interactive subscription login and
  confirm the active account before starting work. Provider login state stays
  in the client's user-owned configuration outside this repository.
- Never copy login tokens, session data, environment dumps, prompts containing
  secrets, or provider output into the repository, Issues, PRs, or artifacts.
- Enabling extra usage, adding billing, changing credentials, and changing
  account access remain human-owned actions.

See [`docs/local-agent-development.md`](local-agent-development.md) for the
operator checklist and command examples.

## Ownership and isolation

- One Issue has one active writer lease. One worktree has one writer process.
- Codex uses `codex/issue-<number>` and Claude Code uses
  `claude/issue-<number>`.
- A second client may continue the same Issue only after the first writer has
  stopped and released its lease or the lease has expired.
- Local leases live under `.agent-runs/leases/`; runtime artifacts are ignored by
  Git.
- Schema migrations, authentication/authorization, shared API contracts, and
  `.github/workflows/` are exclusive scopes. Parallel Issues touching any of
  them must declare a merge order.

## Handoff contract

Before switching clients, the current writer stops editing and creates
`handoff.json` plus `changes.patch` with `pnpm agent:checkpoint`. The manifest
records the Issue, provider, base SHA, branch, completed and remaining work,
changed paths, verification evidence, blocker, and patch SHA-256. Its interface
is defined by [`docs/schemas/handoff.schema.json`](schemas/handoff.schema.json).

The receiving writer must run `pnpm agent:checkpoint:verify`, compare the Issue
and base SHA, inspect the entire patch, and repeat relevant verification. A
handoff is evidence to verify, not authority to trust. Do not include chat
history, hidden reasoning, credentials, personal data, or production data.

Use these blocker labels consistently:

| Status                                                          | Required action                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `rate_limited_transient`, `usage_limit_reached`                 | Save a checkpoint, stop the current client, then continue locally with the other subscribed client. |
| `authentication_failed`, `permission_blocked`, `policy_blocked` | Stop and ask the human owner to resolve access or policy. Do not bypass it with another provider.   |
| `verification_failed`, `agent_failed`, `infrastructure_failed`  | Preserve reproducible evidence and fix or hand off the same scoped task.                            |
| `needs_human_decision`                                          | Stop and request only the material decision required by governance.                                 |

## Cross-review and merge

When practical, use the other local client for a read-only review. Review output
follows [`docs/schemas/review.schema.json`](schemas/review.schema.json) and
focuses on security, authorization, migrations/data loss, concurrency, and
externally observable contracts. The reviewer does not edit the writer's
worktree.

Provider agreement never replaces verification. The protected `Quality`,
`Database`, `E2E`, and `Security` GitHub Actions checks are the final merge gate.
The agents may prepare, review, open, and merge PRs autonomously within
governance; credential, billing, production, and destructive approvals remain
human-owned.
