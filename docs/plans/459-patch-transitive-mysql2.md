# mysql2 の high advisory を解消する

## Issue

- Issue: #459
- Branch: `codex/issue-459`
- Base commit: `ee9dad6de90edf0260dc702168d9a90b95909eab`

## Outcome

Prisma/Better Auth が推移的に解決する `mysql2` を修正版へ統一し、Security gate を復旧する。

## Context

- `pnpm security:check` が `mysql2@3.15.3` の GHSA-3f6p-5ww8-9rcr を high として検出した。
- Levi の application database は PostgreSQL であり、MySQL provider は使用しない。

## Constraints

- dependency override と lockfile だけを変更し、#457 の機能差分を含めない。
- patched 3.x を exact version で固定する。

## Non-goals

- Prisma、Better Auth、database provider の変更
- production deploy

## Plan

1. [x] workspace override で `mysql2` を patched version へ統一する。
2. [x] frozen install、Security、canonical checks を検証する。
3. [ ] PR の required checks 後に merge する。

## Progress

- 2026-09-02 12:35 JST — default branch の `mysql2@3.15.3` と high advisory を再現した。
- 2026-09-02 12:39 JST — `mysql2@3.22.0` へ統一。frozen install、`pnpm security:check`、`pnpm check` が成功した。

## Decisions

- 2026-09-02 — Decision: package-manager override を使用する。
  - Reason: Prisma/Better Auth の compatible 3.x transitive dependency だけを修正版へ収束できる。
  - Alternatives: unrelated top-level framework upgradesは変更範囲が大きいため採用しない。

## Risks and mitigations

- Risk: transitive dependency の想定外の解決変更。
  - Mitigation: lockfile diff、`pnpm why mysql2`、全 canonical checks で確認する。

## Verification

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm why mysql2`
- [x] `pnpm security:check`
- [x] `pnpm check`
- [ ] required CI checks

## Handoff or blockers

- Completed: override、lockfile、local verification。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: commit、PR、CI を完了する。

## Result

作業完了時に更新する。
