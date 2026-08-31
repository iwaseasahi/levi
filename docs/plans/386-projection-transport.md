# Bind direct projection to content and connection generation

- Issue #386, parent #59; branch `codex/issue-386`, base `be3fa4b`.
- ADR 0015 and installed Next 16.3.1 documentation reviewed; current v1 hooks and
  scripture component/E2E behavior inspected. #302 remains open with no comments
  or new measured Sunday evidence as of 2026-08-31. No live-load claims.

## Plan

1. [ ] Version strict transport envelopes with kind, generation, per-document
       instance, challenge-bound READY, command/ACK sequences and bounded selection.
2. [ ] Extract shared controller/audience transport and font/blank state. Keep
       content state validation/navigation and authorization in domain adapters.
3. [ ] Migrate scripture adapters, preserve keyboard/navigation/fit/auth behavior.
4. [ ] Prove spoof/stale/version/reload/reuse handling and existing Chrome flows.
5. [ ] Check, separate review, PR, exact-head required CI and merge.

## Decisions / constraints

- Same-origin named ordinary `projector` tab; retained Window and opener checks.
- Connection nonce in URL fragment, never content; a fragment-only reopen clears
  and reloads the audience to reauthorize. New document instance and CONNECT
  challenge distinguish reload from stale ACK/READY on the same Window.
- Shared envelope contains font, blank, authorization/readiness and sequences.
  Content payload remains adapter validated; no body text, storage or DB model.
- Periodic CONNECT is a protocol liveness probe, not a delayed function call.
  Missing/incompatible peer fails closed and directs the user to Open again.
- No dependency, service, production operation or change to data ownership.

## Progress / blockers

- Isolated worktree and lease acquired before edits. No blockers.
