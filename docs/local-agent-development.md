# Local Codex and Claude Code development

Levi uses the locally installed Codex and Claude Code clients within the
repository owner's flat-rate subscriptions. GitHub Actions runs verification
only. It does not call either model provider.

## One-time human setup

1. Install the official local clients.
2. Sign Codex in with the intended ChatGPT subscription account.
3. Start Claude Code and use `/login` to select the intended Claude subscription
   account.
4. Keep provider API keys out of the shell, repository, GitHub Actions, and
   client configuration used for Levi.
5. Keep paid extra usage disabled unless the human owner explicitly changes the
   cost policy.

Do not use API-key login, `apiKeyHelper`, custom provider base URLs, Anthropic
Bedrock/Vertex/Foundry routing, `codex login --with-api-key`, or `claude
setup-token`. They are not subscription login paths.

Account, billing, extra-usage, secret, and access changes are human-owned. Agents
may inspect whether a login or environment variable exists, but must not print,
copy, rotate, or modify credential material.

## Start-of-task check

From the Issue worktree, confirm the provider-key and provider-routing variables
are absent without printing their values:

```sh
for key in OPENAI_API_KEY CODEX_API_KEY ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN \
  OPENAI_BASE_URL ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY; do
  if printenv "$key" >/dev/null 2>&1; then
    echo "$key=set (stop before running an agent)"
  else
    echo "$key=unset"
  fi
done
```

`codex login status` should report a ChatGPT login. In an interactive Claude
Code session, `/status` should show a Claude subscription login. `claude auth
status` is also machine-readable, but its output contains account metadata and
must not be pasted into Issues, PRs, logs, or artifacts.

Then follow the normal Issue intake in `AGENTS.md`: inspect dependencies, create
one Issue branch/worktree, and acquire its writer lease. For example:

```sh
pnpm agent:lease --action acquire --directory .agent-runs/leases \
  --issue 123 --run-id codex-123-1 --provider codex \
  --branch codex/issue-123 --ttl-minutes 60
```

Release the lease when the writer stops:

```sh
pnpm agent:lease --action release --directory .agent-runs/leases \
  --issue 123 --run-id codex-123-1
```

## Rate-limit handoff

When the current subscription reaches a rate or usage limit, stop that client.
Do not add an API key or enable extra usage. Record concise JSON arrays for
completed steps, remaining work, and verification, then create a checkpoint:

```sh
pnpm agent:checkpoint --workspace "$PWD" \
  --output-dir .agent-runs/handoffs/issue-123-codex-1 \
  --issue 123 --run-id codex-123-1 --provider codex \
  --base-sha "$(git merge-base HEAD origin/main)" \
  --branch codex/issue-123 \
  --completed-steps-file /path/to/completed.json \
  --remaining-work-file /path/to/remaining.json \
  --verification-file /path/to/verification.json \
  --blocker usage_limit_reached \
  --switch-reason subscription_usage_limit
```

The output directory must be under the worktree's ignored `.agent-runs/`
directory. The receiving client verifies the checkpoint before applying or
continuing it; the expected Issue and base SHA are mandatory:

```sh
pnpm agent:checkpoint:verify \
  --directory .agent-runs/handoffs/issue-123-codex-1 \
  --expected-issue 123 \
  --expected-base-sha "$(git merge-base HEAD origin/main)"
```

It must also inspect `changes.patch`, compare the current branch and base, and
repeat relevant checks. A valid hash proves integrity only; it does not prove
that the implementation is correct.

## Local cross-review

After the writer finishes and releases its lease, the other subscribed client
may review the PR or staged diff in read-only mode. The reviewer reports
actionable findings with severity, file/line, evidence, and remediation using
[`schemas/review.schema.json`](schemas/review.schema.json). It does not edit the
writer's worktree and must not expose login state to repository commands.

Resolve findings with the active writer, run the canonical checks, push the PR,
and wait for protected `Quality`, `Database`, `E2E`, and `Security` checks.
Passing CI is required even when both local clients agree.
