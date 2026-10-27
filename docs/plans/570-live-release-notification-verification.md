# Verify real release notifications on the approved one-time deploy

## Issue / outcome

- Issue #570, dependencies #566 and #563.
- Branch `codex/issue-570`; base/release target
  `7874727567c8e7f6de371f4f139ca62af73b4efe`.
- On2026-10-27 the owner explicitly requested a real deploy to verify start and
  completion notifications. Existing production is a9eddac; no new migrations
  exist between it and the pinned target.

## Constraints / decision

- This is one explicitly initiated release, using existing common candidate,
  authorization, root host transaction and observer/outbox code. Do not change
  the timer, clock, installed scheduling guard or standing production authority.
- Preserve exact four CI checks, immutable digests/artifacts, current baseline,
  Tuesday/Sunday host rules, encrypted backup, forward migration and readiness.
- Reuse existing notification-bot / private #levi-deploy and its protected
  credential; no new grant, credential entry or Slack test message.
- The owner authenticates the existing root sudo path for one-time observation
  orchestration. Pin its reviewed SHA/run/digests, expire the authorization and
  refuse duplicate starts. A failed deploy is not automatically retried.
- Public metadata and fixed stage/result codes only. No production data is a
  development fixture, and no secret value enters the workspace or output.
- ADR0018/0019 remain the durable architecture. This is an operational use of
  their common components under the owner's current one-time instruction.

## Plan

1. [x] Read policies, parent Issues, manual/scheduled runbooks and source guards.
2. [x] Isolate branch/worktree and acquire one writer lease; pin current main.
3. [x] Prepare immutable images with the standard command after exact CI.
4. [x] Prepare/review a bounded one-time root execution artifact and validate it
       with synthetic process/state failures, without touching production.
5. [x] Have the owner authenticate the prepared exact execution; deploy once.
6. [x] Correlate Slack start/result IDs with real host/GitHub ready state and
       confirm the ordinary Tuesday timer is unchanged.
7. [ ] Record evidence, merge the scoped documentation after exact CI, close Issue.

## Progress / verification

- 2026-10-27 — Current main7874727 has all four successful jobs in CI
  run40450839883. Production service is inactive/success; next scheduled start
  remains2026-11-03 10:00 JST. No live deploy has begun for this request yet.
- 2026-10-27 — Compared a9eddac..7874727: notification implementation and
  operational documentation only; no Prisma schema/migration or app feature change.
- 2026-10-27 — Standard preparation succeeded: candidate40451607643/attempt1;
  authorization40452087072/attempt1 also succeeded. Immutable application
  `29ed32f7a83830b7d0cef2791f90bd272ac42d1567d93fd9237890a8c4bef82e`,
  migration `26ec26b09b72f8754cd4417756c9c3aeaf17c42ec7d3530384077aac84caa0ae`.
- 2026-10-27 — One-time root helper revalidates canonical merged source/4 CI,
  exact authorization/digests, full ready-state fingerprint and matching host
  history. It invokes the unchanged fixed host entrypoint with its existing
  seven-argument Tuesday baseline checks, under the owner's current instruction.
  It leaves the timer/window guards and installed bundle unchanged. Notifications
  use the existing Store/observe/finish lifecycle and positive host-ready witness.
- 2026-10-27 — Synthetic network-disabled Linux tests: helper9/9 and existing
  observer52/52 passed; Bash syntax and whitespace passed. Cases cover duplicate,
  expiry/date, signal forwarding, start failure, child-observation failure,
  actual positive witness and exit0-without-proof. No production fixture used.
- 2026-10-27 14:03 JST — First authenticated invocation stopped at source/CI
  preflight before observation/application. Ready state remains the exact a9eddac
  baseline and no release identity was created. Reproduced the helper defect:
  `git clone --no-checkout` leaves an empty index, so the subsequent cached-diff
  clean check exits1. CI itself remains successful.
- 2026-10-27 — Corrected the one-time helper to use a normal checked-out clone in
  a new dedicated directory, retaining the incomplete clone and prior private
  execution log. Added six disposable Git tests exercising the actual Bash
  source-preflight fragment: fresh/existing clean clones pass; tracked/staged
  changes, a different origin and failed CI still stop. All six passed. The
  root attempt marker, baseline, exact images/authorization, expiry, CI and
  host checks are unchanged. Corrected bootstrap SHA256:
  `df9aceb2a94460da6e3af624cf8daa886af83250d9f9047121cb2db2f15a8042`;
  supervisor remains `1d85884b3a49c247b716c4a5ba3dadda1c70a3e7d1787112e5b230d4d66616f3`.
- 2026-10-27 14:21 JST — The owner completed the corrected authenticated
  invocation. Release52142a5ee4614202a141cb8ecd31ec7f began14:21:02, finished
  14:21:42 (40seconds), exit0, positive post-ready witness, no warning. Both
  started/succeeded events were sent on attempt1 and verified in the actual
  private Slack channel. GitHub ready matches7874727 and both pinned digests /
  authorization40452087072, recorded05:21:41 UTC; public ready/database are ok.
  Both timers are active and the next ordinary release remains11-03 10:00 JST.

## Handoff or blocker

- Completed: exact images/authorization, reviewed single-use execution and
  synthetic verification, owner-authenticated real deploy, actual Slack receipts
  and positive production ready evidence, operational documentation.
- Remaining: documentation PR, exact-head protected CI, merge and Issue closure.
- Blocker: none. Root credentials are never requested in chat.
- Resume with: review the documentation diff and require all four CI jobs on its
  exact PR head before merge. No further production application is needed.

## Result

- The owner-requested real release and both actual notifications succeeded.
- The helper's initial clone defect was corrected before the only application.
- No new credentials/grants, migration/schema additions, scheduler installation
  or permanent window changes. Ordinary operational safeguards remain intact.
