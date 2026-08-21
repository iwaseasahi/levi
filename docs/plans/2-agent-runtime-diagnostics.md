# Make provider failures observable and fail closed

## Issue

- Issue: #2
- Branch: `codex/issue-2-runtime-diagnostics`
- Base commit: `87ff705585e997b6ece45b65cfadac3b5c05ba59`

## Outcome

The agent orchestration workflow classifies provider failures without depending
on optional runner tools, retains a secret-safe diagnostic in the GitHub log,
and reports an unsuccessful provider run as a failed workflow rather than a
successful run with all downstream jobs skipped.

## Context

- `.github/workflows/agent-orchestration.yml` runs the provider CLIs directly so
  repository scripts never receive provider credentials.
- Run `32434932976` injected the Anthropic secret but Claude exited with code 1.
- The retry shell then failed because `rg` was unavailable on the hosted runner.
- The normalized `agent_failed` result still allowed the job and workflow to
  conclude successfully; the quality gate and publication jobs were skipped.
- `src/agent-orchestration/workflow-credentials.test.ts` guards credential scope
  and bare-mode isolation.

## Constraints

- Preserve provider-secret step scoping and Claude bare mode.
- Do not persist raw provider stdout, stderr, prompts, or secrets as artifacts.
- Preserve successful Codex-to-Claude fallback while failing closed for terminal
  writer failures.
- Do not add an operating-system package installation or a production
  dependency for log matching.

## Non-goals

- Changing API-key authentication to workload identity federation.
- Changing provider choice, retry limits, budgets, or GitHub permissions.
- Publishing an agent-generated patch from the diagnostic rehearsal itself.

## Plan

1. [x] Replace the optional `rg` dependency in credential-bearing retry loops
       with a POSIX-runner command and emit a bounded, redacted stderr diagnostic.
2. [x] Add terminal enforcement steps after checkpoint upload so unsuccessful
       provider outcomes make the workflow fail while fallback outcomes continue.
3. [x] Add static regression coverage for portability, redaction, and fail-closed
       workflow behavior.
4. [ ] Run local checks, open and merge a PR, then rerun the fallback rehearsal
       from `main` and inspect the provider result.

## Progress

- 2026-08-21 10:10 JST — Started from `main` at `87ff705`; inspected Issue #2,
  governance, CI/testing guidance, run `32434932976`, and its checkpoint/logs.
- 2026-08-21 10:13 JST — Completed implementation and focused regression test;
  evidence: 10 unit files / 31 tests passed. Formatting initially identified the
  new plan and was corrected with the repository formatter.
- 2026-08-21 10:15 JST — Completed local verification; `pnpm check`, unit
  coverage, security audit/license inventory, and `git diff --check` passed.

## Decisions

- 2026-08-21 — Decision: keep direct CLI invocation instead of routing provider
  execution through a repository-owned script.
  - Reason: credential scope tests intentionally prevent repository code from
    receiving provider secrets.
  - Alternatives: use `pnpm agent:run`; rejected because it broadens the code
    trusted with provider credentials.
- 2026-08-21 — Decision: print only bounded, token-pattern-redacted stderr into
  the GitHub log and keep raw logs out of artifacts.
  - Reason: GitHub also masks registered secrets, while the local redaction
    covers common bearer and provider-token forms before output.
  - Alternatives: upload raw logs; rejected because artifacts are not an
    approved secret-masking boundary.

## Risks and mitigations

- Risk: a provider error contains an unrecognized confidential value.
  - Mitigation: output stderr only, bound it to 80 lines, redact API-key and
    bearer-token shapes, and rely on GitHub's registered-secret masking as a
    second layer.
- Risk: enforcing failure prevents the Claude fallback from running.
  - Mitigation: enforce Codex success only when routing did not select fallback;
    perform enforcement after checkpoint upload.

## Verification

- [x] `pnpm test:unit -- src/agent-orchestration/workflow-credentials.test.ts`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test:unit`
- [x] `pnpm test:component`
- [x] `pnpm build`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] GitHub fallback rehearsal reaches a definitive Claude result and the
      overall workflow conclusion agrees with it.
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults.

## Handoff or blockers

- Completed: investigation, workflow changes, documentation, and focused test.
- Remaining: full local verification, PR, merge, and fallback rehearsal.
- Blocker: none.
- Resume with: run the remaining local verification commands.

## Result

Pending.
