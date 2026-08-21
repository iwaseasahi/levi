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
   - [x] The first rehearsal failed closed and exposed the root cause: pnpm's
         global layout installed the Claude npm wrapper without its Linux native
         optional package.
   - [x] Replace the global pnpm installation with the version-pinned native
         installation used by Anthropic's official GitHub Action and verify the
         binary before credential injection.
   - [x] Merge the native-install correction and repeat the rehearsal.
   - [x] Supply the repository's non-secret CI database URLs to the agent quality
         gate, then repeat the rehearsal after its `pnpm check` failure.
   - [x] Preserve newly created repository files in checkpoints while excluding
         `agent-artifacts/`, then repeat the rehearsal after the missing-file
         quality-gate failure.

## Progress

- 2026-08-21 10:10 JST — Started from `main` at `87ff705`; inspected Issue #2,
  governance, CI/testing guidance, run `32434932976`, and its checkpoint/logs.
- 2026-08-21 10:13 JST — Completed implementation and focused regression test;
  evidence: 10 unit files / 31 tests passed. Formatting initially identified the
  new plan and was corrected with the repository formatter.
- 2026-08-21 10:15 JST — Completed local verification; `pnpm check`, unit
  coverage, security audit/license inventory, and `git diff --check` passed.
- 2026-08-21 10:18 JST — PR #30 passed all required checks and merged. Rehearsal
  run `32435733077` then failed closed with `Error: claude native binary not
installed`; the API key had not yet been used.
- 2026-08-21 10:20 JST — Replaced both Claude installation steps with the pinned
  native installer and executable/version checks. Focused tests, `pnpm check`,
  coverage, security checks, and `git diff --check` passed again.
- 2026-08-21 10:35 JST — PR #31 merged and rehearsal run `32436059340`
  authenticated successfully: Claude completed in 10m55s and produced a patch.
  The later quality gate failed because it did not inherit the non-secret
  `DATABASE_URL` and `SHADOW_DATABASE_URL` values used by the authoritative CI
  workflow. Added the same values only to the quality-gate job.
- 2026-08-21 10:52 JST — PR #32 merged and rehearsal run `32437003141`
  confirmed the database fix, then failed typechecking because Claude created
  `src/agent-orchestration/metrics.ts` as an untracked file and the checkpoint
  only contained `git diff HEAD`. Updated patch creation to include untracked
  repository files while explicitly excluding runtime artifacts.
- 2026-08-21 11:16 JST — PR #33 merged and rehearsal run `32438038242`
  completed the Claude fallback in 17m53s. The reconstructed patch, including
  new files, passed the common quality gate. The following read-only Codex
  cross-review connected to OpenAI but stopped with `Quota exceeded`, so the
  workflow correctly withheld PR publication.

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
- 2026-08-21 — Decision: install Claude through Anthropic's pinned native
  installer and verify the executable before provider execution.
  - Reason: Anthropic's official GitHub Action uses the native installer, while
    the pnpm global install produced only the wrapper on the hosted runner.
  - Alternatives: repeat pnpm installation or switch to npm global installation;
    rejected because neither matches the maintained official Action path.

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
- [x] GitHub fallback rehearsal reaches a definitive Claude result and proceeds
      to the common quality gate.
- [x] Final infrastructure diff reviewed for scope, secrets, migrations, and
      unsafe defaults.

## Handoff or blockers

- Completed: provider diagnostics, native Claude installation, fail-closed
  behavior, quality-gate configuration, complete patch checkpointing, local
  verification, and a successful Claude fallback plus common quality gate.
- Remaining: complete the required Codex cross-review and publish the generated
  PR through protected CI.
- Blocker: the configured OpenAI API project has no available quota; Codex CLI
  returns `Quota exceeded. Check your plan and billing details.`
- Resume with: add API credit or quota to the project associated with
  `CODEX_API_KEY`, rotate the repository secret if necessary, and repeat the
  fallback rehearsal from `main`.

## Result

The Anthropic API-key path and Claude fallback are operational. The repository
now fails closed at the required cross-provider review because the configured
OpenAI API project has exhausted or lacks quota. No generated PR was published.
