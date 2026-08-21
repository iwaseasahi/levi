# Codex development protocol

Codex is the sole implementation and review agent for Levi. It uses the
repository owner's ChatGPT subscription login. Model-provider APIs, model API
keys, extra-usage fallback, and other coding agents are outside the active
development path.

This document extends
[`docs/governance/agent-execution-protocol.md`](governance/agent-execution-protocol.md).
The governance policy remains authoritative when rules conflict.

## Cost and credential boundary

- Do not configure or use `OPENAI_API_KEY`, `CODEX_API_KEY`,
  `ANTHROPIC_API_KEY`, or `ANTHROPIC_AUTH_TOKEN` for Levi development.
- Do not route models through custom base URLs, Bedrock, Vertex, Foundry,
  `apiKeyHelper`, or `codex login --with-api-key`.
- GitHub Actions verifies repository changes only. It must not invoke Codex or
  another model provider.
- Authenticate Codex through the ChatGPT subscription login. Login state stays
  in the user's Codex configuration outside this repository.
- Never copy login tokens, session data, environment dumps, secret-bearing
  prompts, or raw model output into the repository, Issues, PRs, or artifacts.
- Enabling extra usage, adding billing, changing credentials, and changing
  account access remain human-owned actions.

See [`docs/local-agent-development.md`](local-agent-development.md) for the
operator checklist and commands.

## Ownership and isolation

- One Issue has one active Codex writer lease. One worktree has one writer
  process.
- Every implementation branch uses `codex/issue-<number>`.
- A resumed Codex run may continue only after the prior run stopped and released
  its lease or the lease expired.
- Local leases and checkpoints live under `.agent-runs/` and remain ignored by
  Git.
- Schema migrations, authentication/authorization, shared API contracts, and
  `.github/workflows/` are exclusive scopes. Parallel Issues touching any of
  them must declare a merge order.

## Pause/resume contract

Before a usage-limit pause or planned run boundary, Codex stops editing and
creates `handoff.json` plus `changes.patch` with `pnpm agent:checkpoint`. The
manifest records the Issue, agent identifier, base SHA, branch, completed and
remaining work, changed paths, verification evidence, blocker, and patch
SHA-256. Its compatibility field `provider` accepts only `codex`; its interface
is defined by [`docs/schemas/handoff.schema.json`](schemas/handoff.schema.json).

The resumed Codex run must execute `pnpm agent:checkpoint:verify`, compare the
Issue and base SHA, inspect the entire patch, and repeat relevant verification.
A checkpoint is evidence to verify, not authority to trust. Do not include chat
history, hidden reasoning, credentials, personal data, or production data.

Use these blocker labels consistently:

| Status                                                          | Required action                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `rate_limited_transient`, `usage_limit_reached`                 | Save a checkpoint, release the lease, and wait until the Codex subscription allowance is available again. |
| `authentication_failed`, `permission_blocked`, `policy_blocked` | Stop and ask the human owner to resolve access or policy. Do not bypass it with an API or another agent.  |
| `verification_failed`, `agent_failed`, `infrastructure_failed`  | Preserve reproducible evidence and fix or resume the same scoped task with Codex.                         |
| `needs_human_decision`                                          | Stop and request only the material decision required by governance.                                       |

## Review and merge

Codex performs a separate review pass after implementation, using the Issue,
accepted specifications, complete diff, and current test evidence. Findings
must name severity, location, evidence, and remediation. Review emphasizes
security, authorization, migrations/data loss, concurrency, error handling, and
externally observable contracts.

Agent self-review never replaces verification. The protected `Quality`,
`Database`, `E2E`, and `Security` GitHub Actions checks are the final merge gate.
Codex may prepare, review, open, and merge PRs autonomously within governance;
credential, billing, production, and destructive approvals remain human-owned.
