# Preserve checkpoint checks under slow Git execution

## Issue and constraints

- Issue: #595; prerequisite for #593 / Dependabot #590.
- Historical checkpoint patch scope: #2 and PR #33; current Codex-only policy
  supersedes the historical dual-provider text in #2.
- Branch: `codex/issue-595`; base `203dff949514021016daaefd3e4a48a1ccf3c7f9`.
- Keep real Git, all assertions, the existing 5000ms timeout, zero retries,
  concurrency, coverage and protected checks. No production/dependency change.

## Evidence and decision

#590 head `0b440a211382a066ebb0f8142f8511b20798aab0`, CI run 45306039065,
Quality job 138150002703 times out the checkpoint Git scenario at 5004ms.
Other manifest/lease filesystem tests in that log take 2.7–3.8 seconds while
pure tests take milliseconds. The exact runner scheduling cause is unproven.

The fixture performs seven setup Git commands, although a single committed
baseline containing tracked.ts and .gitignore is equivalent. Replace the two
Git configuration writes with command-local synthetic identity; commit both
baseline files once. Run independent file/directory preparation concurrently.
This removes four unnecessary process launches and serial filesystem waits.
Actual createWorkspacePatch behavior and every assertion remain unchanged.

Controlled reproduction wraps real Git with a 500ms delay before each command:

```sh
mkdir -p /tmp/levi-checkpoint-slow-git
cat > /tmp/levi-checkpoint-slow-git/git <<'SH'
#!/bin/sh
sleep 0.5
exec /usr/bin/git "$@"
SH
chmod +x /tmp/levi-checkpoint-slow-git/git
PATH=/tmp/levi-checkpoint-slow-git:$PATH mise exec -- corepack pnpm exec vitest run --config vitest.config.ts src/agent-orchestration/checkpoint.test.ts -t 'includes untracked source files'
```

Unchanged fixture: FAILED at 5000ms. Patched fixture: PASSED at 3763ms under
identical injection. This is an equivalent-fixture performance repair, not a
claim that the controlled delay identifies the CI host's exact latency source.
No arbitrary timeout increase or flaky-CI rerun was used.

## Plan and verification

1. [x] Read policies, source/history/Issue and original complete CI result.
2. [x] Reproduce with controlled slow Git; isolate writer/worktree.
3. [x] Reduce equivalent setup and prove identical delayed test passes.
4. [x] Run all checkpoint tests: 4 passed (93ms).
5. [ ] Run canonical check, unit coverage and independent diff review.
6. [ ] Verify all four exact-head protected jobs, merge and release lease.
7. [ ] Resume #593 from its checkpoint and refresh #590 for final attempt.

## Risks and remaining work

Only test-fixture construction changes. Initial baseline still tracks the same
source and ignore rule; final modified, untracked and ignored states match.
No application API, checkpoint implementation, migration or production action.
Pending canonical checks, independent review and protected merge. Final commands,
head/run/merge and completion evidence will be recorded in the Issue and PR.
