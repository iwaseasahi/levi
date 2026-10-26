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
2. [x] Owner selected Mac-independent always-on execution on 2026-10-26.
       Design uses the existing VPS systemd timer; no additional billed host or
       inbound SSH exposure. See accepted ADR 0018.
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

## Initial draft verification / progress (before executor choice)

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
- At the initial draft: protected CI, substrate answer and scheduler activation
  remained. The later executor decision below supersedes that blocker.

## 2026-10-26 executor decision and revised implementation

The owner requires execution while the Mac is stopped/asleep. The earlier
Mac-dependent scheduler option is rejected. Prepare a VPS-local systemd timer
and repository-only GitHub App authentication (ADR 0018). No new production
credential, host file, sudo policy or timer has been installed or enabled.

1. [x] Prepare root-owned trusted scheduler bundle, Tuesday 10:00 JST timer and
       App token wrapper; preserve existing CI/artifact checks and use local apply.
2. [x] Move deployment metadata writes under a shared host transaction lock before
       checkout, reverify exact authorization at the host, and compare scheduled
       baseline with actual host history to prevent cross-machine races/rollback.
3. [x] Add synthetic positive/negative authorization, credential redaction, timer,
       installer and host transaction coverage; run canonical/protected checks.
4. [x] Owner explicitly approved the exact App permissions/key, gh package,
       trusted host bundle/entrypoint and timer activation on2026-10-26.
5. [ ] After approval/provisioning, merge, install without running a live release,
       verify timer next trigger and read-only preflight, then close #563.

The proposed installer must leave activation separate and never call
`systemctl start levi-release.service`. App private keys and installation tokens
must never appear in the agent context or logs. No model runs on the host.

## Always-on implementation evidence

- Root-owned installed scheduler bundle and systemd timer prepared; no daemon,
  model, new SSH user, runner or extra server. Installer never starts/enables units.
- Both current manual and scheduled clients require host protocol 2; an older
  host stops before applying rather than leaving release metadata unrecorded.
- Host owns authorization revalidation, exact CI and metadata writes under one
  lock before checkout; scheduled baseline is checked against actual host history.
- `mise run check` passed after the transport/type changes: 587 unit tests,
  129 component tests, existing deployment guards,23 orchestration scenarios,
  19 host transaction scenarios and11 App-authentication tests, plus build.
- `bash -n` passed for all seven changed/new runtime Bash scripts and libraries.
- Ubuntu24.04/systemd255 disposable container verified both unit files and the
  timezone expression (tzdata installed; synthetic docker.service dependency).
- Read-only production inspection confirmed systemd255 and required tools except
  `/usr/bin/gh`; apt candidate is `2.45.0-1ubuntu0.3`. No package was installed.
- The production host parsed the next timer occurrence as
  `2026-10-27 01:00 UTC`, or Tuesday10:00 Japan time. No timer was installed.
- No production key/token was created/read/copied, no host file changed, no live
  deploy and no timer activation. The GitHub App and host changes remain proposed.

## Handoff or blocker

- Intended outcome: Tuesday10:00 JST release of unreleased main commits, without
  per-run approval and independent of the Mac.
- Completed: common and VPS-local execution paths, host transaction cutover,
  App token wrapper, installer/units, ADR0018/runbook, synthetic and canonical
  verification. See PR #564 for the exact pushed head and protected CI evidence.
- Remaining: existing sudo authentication for protected host setup;
  finalize/merge policy and code;
  install reviewed bundle/package and enable only the timer; verify safe dry-run
  and next trigger; record completion in #563.
- Blocker: one-time approval is now granted and GitHub App setup is complete.
  The host requires existing operator sudo password authentication, which must
  be entered by the owner in their terminal, outside Codex.
- Attempts: reused the existing VPS and root application path; avoided new paid
  infrastructure, SSH identity/firewall changes, self-hosted runner and personal
  tokens. Completed synthetic tests and unit validation without real credentials.
- Decision needed: none for the approved exact setup. Only existing operator
  authentication is needed; no password/key/token may be sent in chat.
- Current branch/head: `codex/issue-563`; exact current head recorded in PR #564.
- Resume with: verify the checkpoint/PR head and owner approval scope, acquire
  the Issue lease, then provision through the protected channel without exposing
  key/token values. Do not test by starting the production release service.

## 2026-10-26 approved activation progress

- Owner explicitly approved all three concrete setup operations: repository-only
  App/key, gh2.45.0-1ubuntu0.3 plus reviewed host bundle/entrypoint, and timer-only
  activation. No repeat permission request is needed for those exact operations.
- GitHub admin reauthentication completed by the owner. Created App5476038
  `levi-tuesday-releases`, installation175360432 on `iwaseasahi/levi` only. Actions
  and Actions variables write; Checks/Contents/Metadata read; OAuth/hooks disabled.
- Downloaded the App key without displaying contents, protected the temporary
  file mode0600. The first undownloaded/unused key5034230 was revoked; only the
  successfully downloaded key5034240 remains. No secret value enters an artifact.
- Actual UI uses the API identifier `actions_variables`; corrected the wrapper
  and pinned that external name in the focused regression. No access expansion.
- Root `sudo -n true` requires the operator's existing password authentication.
  Ghostty screen control is prohibited by the tool's safety boundary. Prepare an
  exact one-time setup command for the owner's own terminal; never ask them to
  send passwords, OTPs, key bytes or tokens in chat. Code/CI work continues.
- No live deploy, production package/key installation or timer activation yet.
