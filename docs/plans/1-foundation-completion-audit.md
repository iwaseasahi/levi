# Complete the autonomous development foundation

## Issue

- Issue: #1
- Branch: `codex/issue-1`
- Base commit: `a8d84882cf6bc2baf373b2df9314d8ce3e5a10e4`

## Outcome

Issue #1 is closed with repository and GitHub evidence for every completion
criterion. The final audit records child Issue/PR traceability, protected branch
settings, canonical clean-checkout verification, deliberate negative CI probes,
and the successful final CI run.

## Context

- Child Issues #3 through #12 and the local agent extension #2 are closed.
- PRs #13 through #22 and #36 are merged.
- `main` requires up-to-date `Quality`, `Database`, `E2E`, and `Security`
  checks, zero human approvals, linear history, and no force push/deletion.
- Existing PR evidence covers deliberate component, coverage, and E2E failures,
  but does not independently prove lint, type, unit, and migration failure paths.

## Constraints

- Do not alter product behavior, dependencies, schema, migrations, production,
  secrets, permissions, billing, or external services.
- Negative probes may exist temporarily on this PR branch but must be fully
  reverted before the final merge.
- Never weaken a check to make a probe or final run pass.
- The final tree must differ from `main` only by durable completion evidence.

## Plan

1. [x] Audit child Issues, merged PR evidence, branch protection, and current
       repository contracts.
2. [x] Run isolated CI probes for lint, typecheck, unit, migration, and E2E;
       record run URLs and observed failing steps.
3. [x] Restore the valid tree and add the final completion evidence matrix.
4. [ ] Run the full local gates, pass protected CI, merge, and close #1.

## Progress

- 2026-08-21 12:45 JST — Confirmed Issues #2 through #12 are closed, PRs #13
  through #22 and #36 are merged, and `main` protection requires the four
  strict checks with zero human approvals and no administrative bypass.
- 2026-08-21 12:50 JST — Mapped the nine parent completion criteria to existing
  repository files and PR evidence. Identified negative lint/type/unit/migration
  probes as the only missing direct CI evidence.
- 2026-08-21 13:05 JST — Observed isolated lint, typecheck, unit, migration, and
  E2E defects fail in their intended GitHub Actions jobs. Restored every probe
  and added the durable completion matrix with run URLs.
- 2026-08-21 13:15 JST — Cloned the branch into a new temporary directory,
  completed frozen install and the documented `.env.example` setup, then passed
  the single `pnpm check` quality command.

## Decisions

- 2026-08-21 — Decision: use temporary, visibly failing commits on the audit PR
  branch and restore each before the next probe.
  - Reason: a real GitHub Actions failure is stronger evidence than asserting
    that command composition should fail.
  - Alternative: unit-test workflow text; rejected because it would not prove
    the hosted runner and protected job actually reject the defect.

## Risks and mitigations

- Risk: an intentional defect reaches `main`.
  - Mitigation: branch protection requires all four checks on the final head;
    every probe is reverted and the final diff is audited before merge.
- Risk: one failure masks another in a sequential quality job.
  - Mitigation: push and observe each Quality probe separately.

## Verification

- [x] Clean install and `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Deliberate lint failure observed in CI
- [x] Deliberate typecheck failure observed in CI
- [x] Deliberate unit-test failure observed in CI
- [x] Deliberate migration failure observed in CI
- [x] Deliberate E2E failure observed in CI
- [ ] Final protected CI succeeds on the restored head

## Handoff or blockers

- Completed: foundation audit, negative probes, restoration, and evidence matrix.
- Remaining: clean-checkout/local verification, final CI, merge, and Issue closure.
- Blocker: none.
- Resume with: verify a clean checkout and run the final gates.

## Result

Pending.
