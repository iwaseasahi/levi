# Make Codex the sole Levi development agent

## Issue

- Issue: #62
- Branch: `codex/issue-62`
- Base commit: `fb2ff0f1d4de21d2b7c6538fa5e0fb6b5b0a4c92`

## Outcome

Active repository instructions, local-development guidance, and agent runtime
contracts use Codex as the sole implementation and review agent. A subscription
usage limit pauses work safely instead of routing it to Claude Code or a model
API.

## Context

- `AGENTS.md`
- `README.md`
- `docs/local-agent-development.md`
- `docs/agent-protocol.md`
- `docs/schemas/handoff.schema.json`
- `scripts/agent-handoff.ts`
- `src/agent-orchestration/`
- Product-owner direction on 2026-08-21 to use Codex only after upgrading the
  Codex plan

## Constraints

- Codex uses the repository owner's ChatGPT subscription login.
- Model-provider API keys, extra usage, and model calls from GitHub Actions
  remain prohibited.
- Preserve deterministic CI, one-writer isolation, checkpoint integrity, and
  governance approval boundaries.
- Preserve the prior dual-client and provider-API experiments as historical
  evidence; do not present them as active policy.

## Non-goals

- Changing the owner's account, billing, login, or credentials
- Deleting Git history, Issue comments, or archived plans
- Changing protected CI checks or production authority

## Plan

1. [x] Replace active dual-client instructions with Codex-only execution,
       self-review, and pause/resume guidance.
2. [x] Remove the Claude Code adapter and narrow runtime contracts to Codex.
3. [x] Add or update regression coverage for the Codex-only contract.
4. [x] Run all canonical checks and review the final diff.
5. [ ] Open a PR, verify the protected checks on its head, and merge.

## Progress

- 2026-08-21 13:50 JST — Started from merged `main`; inspected Issue #2,
  active instructions, local agent documentation, checkpoint/lease contracts,
  and regression tests.
- 2026-08-21 13:52 JST — Created Issue #62 to supersede the active dual-client
  policy while retaining historical evidence.
- 2026-08-21 14:00 JST — Replaced active instructions with Codex-only
  execution, removed `CLAUDE.md`, restricted checkpoint/lease creation and
  checkpoint verification to Codex, and added regression coverage.
- 2026-08-21 14:01 JST — `pnpm check`, integration tests, Chromium E2E,
  security checks, and diff review passed. The first integration invocation had
  an incomplete tool PATH and was rerun successfully with the local Docker
  binary available.

## Decisions

- 2026-08-21 — Decision: Codex is the only active Levi coding agent.
  - Reason: the product owner upgraded the Codex subscription allowance and no
    longer wants Claude Code used for implementation or review.
  - Alternatives: Codex/Claude fallback and parallel development; rejected for
    current operations.
- 2026-08-21 — Decision: retain checkpoint and lease primitives.
  - Reason: they still protect resumability and single-writer ownership when a
    Codex run pauses or its subscription allowance is temporarily unavailable.

## Risks and mitigations

- Risk: removing cross-provider review reduces viewpoint diversity.
  - Mitigation: require a fresh Codex self-review against the Issue, full diff,
    security/data-loss checklist, and all protected deterministic CI checks.
- Risk: a usage limit interrupts a partially complete Issue.
  - Mitigation: write an integrity-bound checkpoint, release the writer lease,
    and resume with Codex only after allowance returns.

## Verification

- [x] `pnpm check` — 19 unit tests, 2 component tests, typecheck, build passed
- [x] `pnpm test:integration` — 6 tests passed
- [x] `pnpm test:e2e` — 1 Chromium test passed
- [x] `pnpm security:check` — no high vulnerabilities; 214 licenses approved
- [x] `git diff --check`
- [x] Active instructions contain no Claude Code execution, branch, fallback,
      or cross-review path
- [x] Final diff reviewed for scope, secrets, unsafe defaults, and stale policy

## Handoff or blockers

- Completed: implementation, regression coverage, local verification, and
  Codex review.
- Remaining: open the PR, verify protected CI on its head, and merge.
- Blocker: none.
- Resume with: commit the verified change and open the PR.

## Result

Active development now uses Codex only. The Claude adapter and active
cross-provider routes are removed; pause/resume checkpoints, single-writer
leases, self-review, and deterministic protected CI remain required.
