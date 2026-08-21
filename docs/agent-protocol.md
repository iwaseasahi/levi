# Provider-neutral agent protocol

This document defines the repository contract for Codex and Claude Code. It
extends the lifecycle in `docs/governance/agent-execution-protocol.md`; the
governance policy remains authoritative when rules conflict.

## Ownership and isolation

- One Issue has one active writer lease. One worktree has one writer process.
- Codex uses `codex/issue-<number>` and Claude uses
  `claude/issue-<number>`. A fallback may continue the existing provider branch
  only after the first writer has stopped and its lease is released or expired.
- The orchestration workflow uses an Issue-scoped GitHub Actions concurrency
  group. Local runners use `.agent-runs/leases/issue-<number>.json`.
- Schema migrations, authentication/authorization, shared API contracts, and
  `.github/workflows/` are exclusive scopes. Parallel Issues touching one of
  these paths must declare their merge order rather than run concurrently.

## Handoff contract

Every stopped or switched run creates `handoff.json` and `changes.patch`. The
manifest records schema version, Issue/run/provider/model, base SHA, branch and
worktree, completed and remaining work, changed paths, verification evidence,
blocker/switch reason, retry time, and the patch SHA-256. The JSON interface is
defined by `docs/schemas/handoff.schema.json` and the matching `HandoffManifest`
type in `src/agent-orchestration/types.ts`.

The patch includes tracked modifications and newly created repository files.
Runtime files under `agent-artifacts/` are deliberately excluded so prompts,
provider output, and normalized results cannot be folded back into source
changes or published by the downstream PR job.

Artifacts contain facts and reproducible evidence only. Do not include chat
history, hidden reasoning, provider credentials, environment dumps, personal
data, or production data. The receiving writer must verify the Issue, base SHA,
patch hash, diff, and tests. A handoff is not proof that a claim is correct.

## Status normalization and routing

| Status                                                          | Retry or route                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `succeeded`                                                     | Continue to the common quality gate.                                      |
| `rate_limited_transient`                                        | Retry up to three times with jittered exponential backoff; then fallback. |
| `usage_limit_reached`                                           | Checkpoint and fallback immediately.                                      |
| `authentication_failed`, `permission_blocked`, `policy_blocked` | Stop. Never conceal access or policy failures with another provider.      |
| `verification_failed`, `agent_failed`                           | Return to the current writer or stop with evidence.                       |
| `infrastructure_failed`                                         | Retry infrastructure separately; do not switch provider.                  |
| `needs_human_decision`                                          | Stop and request the smallest material decision.                          |

`scripts/agent-runner.ts` implements normalization and routing. It never prints
provider output or environment variables into the normalized result.

## Provider invocation

Codex runs non-interactively with an explicit `workspace-write` sandbox,
ephemeral state, ignored user configuration, strict configuration validation,
JSONL events, stdin prompt, and a subprocess environment filter that removes all
provider API keys. Claude runs in bare print mode so repository hooks, plugins,
MCP configuration, and local login state are not loaded; it uses JSON output,
`acceptEdits`, no persisted session, a hard workflow timeout, and a dollar
budget. The current Claude CLI does not expose a turn-count flag, so the timeout
and budget are the enforceable bounds. The workflow pins the CLI package
versions; updating them requires the normal dependency/security review.

Claude credential-bearing steps do not enable the Bash tool. The fallback writer
uses repository file tools and the later credential-free quality gate runs all
commands. Claude review receives the staged diff in its prompt and uses read-only
file/search tools. Codex may use shell commands, but its subprocess environment
explicitly excludes all provider API-key variables.

The prompt treats the Issue as scoped task data. Only a repository collaborator
with write permission may dispatch an agent workflow. Pull-request or Issue
text never starts a writer automatically.

## Credential and permission boundaries

- `prepare` receives only a read-only GitHub token and no provider credential.
- Only the exact `codex exec` wrapper step receives `CODEX_API_KEY`; checkout,
  dependency installation, routing, checkpointing, and artifact steps cannot
  read it.
- Only the exact Claude invocation step receives `ANTHROPIC_API_KEY`; checkout,
  dependency installation, patch application, and artifact steps cannot read it.
- Provider jobs have read-only GitHub permission and export a patch/checkpoint.
- `quality_gate` has no provider credential and a read-only GitHub token.
- `open_pr` is the only job with repository write permission and has no provider
  credential. It publishes only a patch that passed the shared quality gate.
- No agent job receives production credentials. Secrets must not be put in
  prompts, manifests, logs, or artifacts.

## Cross-review

The writer and reviewer use different providers. Review is read-only and
returns findings with severity (`critical`, `high`, `medium`, `low`), file/line,
evidence, and a verification/remediation proposal. Focus review on security,
authorization, migrations/data loss, concurrency, and externally observable
contracts. Formatter output is not a review finding. Required CI—not agent
agreement—is the final merge gate.

## Staged rollout and metrics

1. Manual provider selection and handoff.
2. Automatic classification/checkpoint.
3. Automatic Codex-to-Claude fallback.
4. Cross-provider review.
5. Parallel independent Issues.
6. Explicit, isolated competition for high-risk decisions only.

Advance a stage only after at least five representative Issues have no
unexplained credential exposure, lease collision, missing artifact, or bypassed
quality gate. Record completion/fallback rate, classification corrections,
first-pass CI, review fix count, conflicts/reverts, elapsed time, provider cost,
major review findings, and human interventions in the workflow summary or Issue.

## Local rehearsal

The classifier and handoff can be exercised without provider credentials:

```sh
pnpm test:unit -- src/agent-orchestration
pnpm agent:route --result tests/fixtures/agent-runs/rate-limit.json
```

After the approved Anthropic sandbox credential is configured, dispatch
`Agent orchestration` with `simulate_codex_usage_limit` enabled to exercise the
complete Claude handoff without waiting for a real account limit. This switch is
manual-only, visible in the run inputs, and never converts authentication or
policy failures into fallback.

Provider-backed workflow execution and secret creation are external/cost actions
and require the repository owner to configure approved sandbox credentials.

## Primary CLI references

- [OpenAI Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Anthropic Claude Code programmatic mode](https://code.claude.com/docs/en/headless)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
