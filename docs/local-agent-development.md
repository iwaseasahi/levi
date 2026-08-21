# Local Codex development

Levi uses Codex as its sole implementation and review agent. Codex runs locally
through the repository owner's ChatGPT subscription. GitHub Actions performs
deterministic verification only and never calls a model provider.

## One-time human setup

1. Install the official Codex client.
2. Sign Codex in with the intended ChatGPT subscription account.
3. Keep model-provider API keys out of the shell, repository, GitHub Actions,
   and Codex configuration used for Levi.
4. Keep paid extra usage disabled unless the human owner explicitly changes the
   cost policy.

Do not use API-key login, `apiKeyHelper`, custom model-provider base URLs,
cloud-provider model routing, or `codex login --with-api-key`. Claude Code and
other coding agents are outside the active Levi development workflow.

Account, billing, extra-usage, secret, and access changes are human-owned. Codex
may inspect whether a login or environment variable exists, but must not print,
copy, rotate, or modify credential material.

## Start-of-task check

From the Issue worktree, confirm model-provider key and routing variables are
absent without printing their values:

```sh
for key in OPENAI_API_KEY CODEX_API_KEY ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN \
  OPENAI_BASE_URL ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK \
  CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY; do
  if printenv "$key" >/dev/null 2>&1; then
    echo "$key=set (stop before running Codex)"
  else
    echo "$key=unset"
  fi
done
```

`codex login status` must report a ChatGPT login. Do not paste account metadata,
login state, or tokens into Issues, pull requests, logs, or artifacts.

Then follow the normal Issue intake in `AGENTS.md`: inspect dependencies, create
one `codex/issue-<number>` branch/worktree, and acquire its writer lease:

```sh
pnpm agent:lease --action acquire --directory .agent-runs/leases \
  --issue 123 --run-id codex-123-1 --provider codex \
  --branch codex/issue-123 --ttl-minutes 60
```

Release the lease when the active writer stops:

```sh
pnpm agent:lease --action release --directory .agent-runs/leases \
  --issue 123 --run-id codex-123-1
```

## Subscription-limit pause and resume

When the Codex subscription reaches a rate or usage limit, do not add an API
key, enable extra usage, or switch to another coding agent. Stop editing, record
concise JSON arrays for completed steps, remaining work, and verification, then
create an integrity-bound checkpoint:

```sh
pnpm agent:checkpoint --workspace "$PWD" \
  --output-dir .agent-runs/checkpoints/issue-123-codex-1 \
  --issue 123 --run-id codex-123-1 --provider codex \
  --base-sha "$(git merge-base HEAD origin/main)" \
  --branch codex/issue-123 \
  --completed-steps-file /path/to/completed.json \
  --remaining-work-file /path/to/remaining.json \
  --verification-file /path/to/verification.json \
  --blocker usage_limit_reached \
  --switch-reason wait_for_codex_subscription_allowance
```

Store the checkpoint only below the worktree's ignored `.agent-runs/`
directory, then release the writer lease. After the Codex allowance is
available again, verify the checkpoint before continuing:

```sh
pnpm agent:checkpoint:verify \
  --directory .agent-runs/checkpoints/issue-123-codex-1 \
  --expected-issue 123 \
  --expected-base-sha "$(git merge-base HEAD origin/main)"
```

Inspect `changes.patch`, compare the current branch and base, acquire a fresh
Codex writer lease, and repeat relevant checks. A valid hash proves checkpoint
integrity only; it does not prove implementation correctness.

## Codex review and merge

Before marking a pull request ready, Codex performs a distinct review pass over
the Issue, accepted ADRs, complete diff, and current verification evidence.
Review security, authorization, migration/data-loss risk, concurrency, error
handling, tests, and externally observable behavior. Record actionable findings
with severity, file/line, evidence, and remediation; do not rely on hidden chat
history as evidence.

Resolve findings, rerun the canonical checks, push the pull request, and wait
for protected `Quality`, `Database`, `E2E`, and `Security` checks. Deterministic
CI is required even after Codex's review passes.
