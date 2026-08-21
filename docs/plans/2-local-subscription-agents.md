# Run Codex and Claude Code without provider API billing

> Historical completion record for Issue #2. Issue #62 supersedes the
> dual-client operating policy; current work uses Codex only under
> [`../agent-protocol.md`](../agent-protocol.md).

## Issue

- Issue: #2
- Branch: `codex/issue-2-local-subscription`
- Base commit: `64c6e1fdd10c9bbea2e2b96585c04e650ee167e5`

## Outcome

Levi uses locally authenticated Codex and Claude Code clients within their
subscription allowances. GitHub Actions never invokes a model provider. Local
checkpoint, lease, and review contracts make writer handoff and cross-review
repeatable without storing credentials or chat history in the repository.

## Context

- Issue #2 replaced the API-key orchestration scope with local subscription use.
- `.github/workflows/agent-orchestration.yml` is disabled on GitHub but remains
  executable in the repository until removed.
- `scripts/agent-runner.ts` currently mixes reusable checkpoint/lease commands
  with provider invocation, output normalization, and automatic routing.
- `docs/agent-protocol.md`, `docs/ci.md`, and `README.md` still describe the
  provider-backed workflow.
- `gh secret list` returned no repository secrets on 2026-08-21.

## Constraints

- Do not invoke Codex or Claude Code through GitHub Actions.
- Do not use `CODEX_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.
- Preserve deterministic CI, branch protection, checkpoint integrity, and
  one-writer ownership.
- Never store OAuth tokens, local client state, prompts containing confidential
  data, or provider output in Git or CI artifacts.

## Non-goals

- Automating subscription login or exporting subscription credentials.
- Unattended provider execution on a shared runner.
- Changing production deployment, migrations, or product behavior.

## Plan

1. [x] Remove the provider-backed workflow and provider invocation/routing code.
2. [x] Keep a local-only handoff CLI for leases, checkpoint creation, and
       checkpoint verification, including complete/remaining work evidence.
3. [x] Rewrite agent, CI, and setup documentation for subscription-authenticated
       local writers and reviewers.
4. [ ] Run canonical checks, open a PR, pass protected CI, merge, and close #2.

## Progress

- 2026-08-21 12:05 JST — Started from `main` at `64c6e1f`; inspected Issues #1
  and #2, repository governance, CI/testing contracts, current agent workflow,
  local scripts, open PRs, branches, and repository secret names.
- 2026-08-21 12:15 JST — Removed the provider-backed workflow, runner,
  classifier, routing fixtures, and provider-result schema. Added the local
  lease/checkpoint CLI, integrity verification, and a regression test that
  forbids provider invocations or API keys in automation.
- 2026-08-21 12:20 JST — Replaced the operating documentation with the local
  subscription protocol and archived the obsolete API experiment plans with a
  non-executable warning. Confirmed both local clients use subscription login
  and all provider API-key environment variables are unset.
- 2026-08-21 12:25 JST — Passed the canonical quality, coverage, integration,
  E2E, and security gates. Rehearsed a non-empty local checkpoint marked
  `usage_limit_reached` and verified its Issue, base SHA, and patch integrity.
- 2026-08-21 12:35 JST — Claude Code reviewed the complete diff with its local
  Pro subscription. Addressed its findings by broadening the API-path guard,
  documenting alternate billing routes, constraining checkpoint output,
  requiring receipt expectations, rejecting unknown options, and updating the
  provider-neutral instructions. All gates passed again. A focused re-review
  lost its connection mid-response; no result from that retry is claimed.

## Decisions

- 2026-08-21 — Decision: remove the provider workflow rather than leave it only
  disabled in GitHub.
  - Reason: a checked-in manual workflow can be re-enabled accidentally and is
    incompatible with the zero provider-API-cost boundary.
  - Alternatives: keep it disabled; rejected because repository state should
    enforce the durable policy.
- 2026-08-21 — Decision: retain checkpoint and lease primitives in a local-only
  CLI while deleting provider command construction, execution, classification,
  and routing.
  - Reason: handoff evidence and writer ownership remain useful with local
    subscription clients; provider automation does not.

## Risks and mitigations

- Risk: removing orchestration also removes useful handoff behavior.
  - Mitigation: preserve and extend checkpoint/lease commands with integrity and
    expected-Issue/base verification.
- Risk: a local API-key environment variable silently overrides subscription
  login.
  - Mitigation: document explicit unset/status checks before agent work.

## Verification

- [x] `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Repository contains no provider API-key execution path
- [x] Simulated local subscription-limit checkpoint and receipt verification
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: implementation and local verification.
- Remaining: independent review, PR, protected CI, merge, and Issue closure.
- Blocker: none.
- Resume with: review the final diff, then open the PR.

## Result

Pending.
