# Levi execution plans

Use an execution plan for work that is multi-step, crosses subsystems, depends on
unresolved investigation, or may be handed to another coding agent. A plan is a
living implementation artifact, not a speculative essay.

## Rules

- Start from the Issue's outcome and acceptance criteria.
- Reference repository paths and commands that actually exist.
- Separate confirmed facts from assumptions and decisions.
- Keep `Progress` current as work advances.
- Add decisions when they are made, including rejected alternatives when useful.
- Record verification evidence rather than saying only that work was tested.
- If the work is handed off, another agent must be able to resume from the plan,
  Git state, and linked artifacts without the original chat transcript.
- Durable architecture choices belong in ADRs; link them from the plan.

## Template

Copy the template below into the task's working notes or pull request. For a
long-running repository change, use `docs/plans/<issue-number>-<slug>.md`.

```md
# <Outcome-oriented title>

## Issue

- Issue: #<number>
- Branch: `<branch>`
- Base commit: `<sha>`

## Outcome

Describe the observable result that must exist when this plan is complete.

## Context

List relevant repository paths, ADRs, product documents, current behavior, and
evidence discovered during investigation.

## Constraints

- State compatibility, safety, architecture, performance, migration, and scope
  boundaries.
- Link applicable governance and approval requirements.

## Non-goals

- List work that is intentionally excluded.

## Plan

1. [ ] A concrete, independently verifiable step.
2. [ ] The next step and its expected evidence.

## Progress

- YYYY-MM-DD HH:MM TZ — Started; inspected `<paths>`.
- YYYY-MM-DD HH:MM TZ — Completed step 1; evidence: `<command or artifact>`.

## Decisions

- YYYY-MM-DD — Decision: `<decision>`
  - Reason: `<evidence and trade-off>`
  - Alternatives: `<rejected options>`
  - ADR: `<link, if durable>`

## Risks and mitigations

- Risk: `<failure mode>`
  - Mitigation: `<test, guard, rollback, or monitoring>`

## Verification

- [ ] `<canonical command>` — expected result
- [ ] Acceptance criterion `<criterion>` — evidence
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: `<facts>`
- Remaining: `<specific steps>`
- Blocker: `<exact condition and evidence, or none>`
- Resume with: `<smallest safe next action>`

## Result

Complete this section at the end with the merged outcome, verification evidence,
remaining risks, and follow-up Issues.
```

