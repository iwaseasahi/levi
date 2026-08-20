# Agent execution protocol

This protocol turns an assigned Issue into a verifiable pull request without
depending on the original chat or on a human writing code.

## 1. Intake and readiness

Read the Issue, parent/dependencies, `AGENTS.md`, governance, applicable ADRs,
product documents, and the current implementation. An Issue is ready only when
it contains an observable Outcome, Context, Constraints, Acceptance criteria,
Non-goals, and Verification plan.

Classify missing information before asking a human:

- **Safe assumption:** discoverable from repository evidence, reversible, does
  not alter product behavior, access, cost, data handling, or a durable
  architecture choice. Record the assumption and proceed.
- **Material ambiguity:** two plausible answers produce different user behavior,
  compatibility, security/privacy posture, destructive impact, external change,
  material cost, or long-lived architecture. Stop and request the smallest
  decision that resolves it.
- **Missing evidence:** investigate with read-only inspection or a disposable
  reproduction. Do not turn lack of investigation into a human question.

If acceptance criteria contradict constraints or cannot be objectively tested,
the Issue is not ready. Record the conflict instead of silently redefining done.

## 2. Plan and isolate

Create `codex/issue-<number>` from current `main` in an isolated worktree. Use a
`PLANS.md` execution plan when the work is multi-step, crosses subsystems, or may
be handed off. Map every acceptance criterion to a planned implementation and
verification item.

Open a draft pull request after the first coherent commit for long-running work.
This makes scope, CI state, and handoff visible without claiming readiness.

## 3. Implement and verify

Work in the smallest vertical increments that can be tested. After each
meaningful increment:

1. Run the narrowest relevant check and add regression coverage.
2. Update the plan with evidence and decisions.
3. Inspect the diff for scope, unsafe defaults, secrets, and generated noise.
4. Commit an outcome-oriented unit that another agent can understand.

Before ready-for-review status, run every applicable canonical check from
`AGENTS.md`, migration rehearsal, and E2E scenario. Record exact commands and
results in the PR; CI evidence must refer to the exact head commit.

## 4. Pull-request sizing

Split work when any of these boundaries can be independently merged and verified:

- mechanical preparation or dependency upgrade before behavior change;
- schema expansion before data backfill, and backfill before constraint removal;
- backend contract before UI consumption when compatibility can be preserved;
- reusable infrastructure before the first product vertical slice;
- refactor before behavior change;
- security hardening or permission change that deserves isolated evidence;
- generated or bulk migration output that obscures hand-written logic.

As a review signal, investigate splitting when hand-written changes exceed about
500 lines, touch more than one independently deployable concern, or require more
than one rollback strategy. Line count alone is not a reason to split, and a
split must not create an invalid intermediate state. Use stacked PRs only with
explicit dependency links and stable base branches.

## 5. Ready, merge, and close

Convert the draft to ready only when the template is complete, no blocker is
hidden, local evidence is current, and required CI is running on the head commit.
Merge only after all protected checks pass. After merge, verify the linked Issue
closed and synchronize the local `main` before taking the next Issue.

Production deployment, production migration, secrets/access changes, and other
approval-bound actions remain stopped even when the code PR is mergeable.

## Incomplete or blocked handoff

Use this exact structure in the Issue, draft PR, or execution plan:

```md
## Handoff or blocker

- Intended outcome: <observable result>
- Completed: <commits, paths, and verified facts>
- Remaining: <ordered concrete work>
- Blocker: <exact condition and evidence>
- Attempts: <safe alternatives already tried>
- Decision needed: <smallest human choice or access change>
- Current branch/head: <branch and SHA>
- Resume with: <first safe command or edit>
```

Never close an Issue, mark a PR ready, or describe partial work as complete while
this section contains an unresolved blocker.

## UI references

An Issue that changes UI must define relevant states (loading, empty, error,
success, disabled), responsive behavior, keyboard/focus expectations, accessible
names, and acceptance evidence. Attach only assets the project is allowed to use
and state whether each is a binding specification or visual inspiration. Do not
copy confidential screens or include personal/production data. Store durable,
approved assets in the repository; a chat-only image is not durable evidence.
