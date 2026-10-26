# Release unreleased main commits on Tuesday at 10:00 JST

## Issue / owner decision

- Issue #563; branch `codex/issue-563`.
- Base `3dab1435cccc48722c6b6c01cea4cbea30ed687b`.
- Owner explicitly requested Tuesday automatic production deploys only for
  unreleased commits, without per-run approval, and selected 10:00 Asia/Tokyo.
- This authorizes the scheduled application/migration path only. No immediate
  release, Sunday deployment, credential/access change, import or restore.

## Context and confirmed facts

- ADR 0005 currently restricts production SSH to the allowlisted operator Mac.
- GitHub has no production SSH key or self-hosted runner. Existing validation
  workflows already need no review except the separate Sunday Environment.
- The non-secret deployment record is ready at commit
  `5639361addaebbed31865fa866f09feae7d096a2`; current main is different.
- Existing scripts pin one main SHA, require all four CI jobs, validate immutable
  candidate/authorization artifacts, then invoke the constrained host entrypoint.
- The host handles deployment locking, operational backup, forward migrations,
  readiness and successful deployment history.

## Plan

1. [x] Inspect intake, governance, ADR, runbook, canonical checks and safe metadata.
2. [ ] Confirm scheduler substrate with owner: existing Mac/Codex availability
       versus an independent always-on trusted execution path. Question pending.
3. [x] Implement platform-independent release selection/orchestration through the
       existing operator path, plus machine-readable pinned preparation output.
4. [x] Add unattended guards: Tuesday start, no approval waiting, changed-state
       detection and exact commit binding; retain manual/Sunday behavior.
5. [x] Add synthetic execution tests for no-op, valid new release, invalid or
       non-ready state, non-forward commits, concurrent runs, CI/preparation
       failure, changed state and approval-required workflows.
6. [ ] Record the narrowly scoped owner authorization in governance/ADR/runbooks,
       run canonical and protected checks, and merge.
7. [ ] Activate the chosen scheduler only after the tested code is in main;
       validate read-only preflight/schedule metadata, without a live test deploy.

## Decisions / constraints

- Compare current main to the last _successful ready_ deployment, rather than a
  prepared candidate, Git tag or failed deployment attempt.
- Same commit is a no-op before publishing images or contacting production.
- Missing/malformed/not-ready state or non-forward ancestry fails closed.
- Pin the selected SHA and recheck production state immediately before apply;
  do not overwrite another successful/manual deployment with an older candidate.
- Keep all four CI checks, immutable images, backup/migrations/readiness and host
  locking/history. Do not grant CI production network access or store a new key.
- The scheduled entry is deterministic; any model-based scheduler only invokes
  it and may not replace its checks with ad hoc production commands.
- Do not activate or claim always-on scheduling before the substrate decision.

## Verification / progress

- Intake and isolated worktree/lease complete. No production mutation performed.
- Added deterministic Bash orchestration, strict non-secret ready-state validation,
  preparation JSON output, exact unattended binding and shared operator apply lock.
- Existing manual/Sunday deployment guards passed unchanged behavior checks.
- 24 synthetic end-to-end command scenarios passed with fake GitHub/Git/SSH/date;
  covered no-op/new release, invalid and in-progress state, failed/missing CI,
  non-forward/fork/dirty source, concurrent locks, changed state at prepare/apply,
  invalid authorization, no approval waiting, local day rollover and a remote-day
  refusal that leaves the state deploying rather than falsely recording success. Four malformed
  preparation argument cases also fail before external actions.
- Real read-only preflight correctly selected current main versus the recorded
  ready release. It started no image workflow, authorization or production SSH.
- Governance/ADR/runbook now record the explicit scoped Tuesday owner decision.
- Final `mise run check` passed: formatting, lint, typecheck,587 unit tests,
  129 component tests, existing deployment checks,24 synthetic scenarios, all
  other configuration guards and the production build.
- `pnpm security:check` passed: no high/critical advisories,354 approved production
  dependency license records. `git diff --check` passed.
- Review sizing: one cohesive operator-path change with shared exact-mode/state
  guards; most added code is synthetic transport fixtures and operational docs.
  No application/schema/migration/dependency version or workflow permission change.
- Remaining: protected CI, substrate answer and scheduler activation. Keep the PR
  draft and the schedule disabled until the execution choice is incorporated.

## Handoff

- Completed: current-flow inspection, exact requested schedule, safe deployed SHA.
- Remaining: code/tests, policy/runbook amendment, protected merge, scheduler.
- Decision needed: execution substrate only; no new access has been authorized.
