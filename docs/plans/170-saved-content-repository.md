# Saved content repositoryと順序更新を整理する

## Issue

- Issue: #170
- Parent: #158
- Branch: `codex/issue-170`
- Base commit: `55cf80a`

## Outcome

Saved contentのmapping、catalog validation、locking、orderingを独立境界へ分け、tenant-scoped CRUDと決定的な連番を維持する。定数raw SQLは型付きsafe raw APIだけを使う。

## Context

- `src/infrastructure/database/saved-content-repository.ts`は349行で、view mapping、Bible catalog validation、row lock、same-ID-set、CRUD、orderingを保持する。
- folder/bookmark reorderはaggregate rowをlockし、complete ID setを検証してからdeferrable unique constraint下で逐次更新する。
- 現行integrationはforeign folder setとfolder reorder/delete競合を検証するが、foreign bookmark setとbookmark reorder/delete競合は未検証。

## Constraints

- DB schema、merged migration、物理削除、tenant boundary、deferred unique constraintを変更しない。
- bulk updateはrepresentative synthetic dataのquery planで有効性を証明できる場合だけ採用する。
- production dataと実dumpをfixture/artifactへ含めない。

## Non-goals

- schema migration、soft delete、履歴、UI/API contract変更。
- 計測なしのSQL最適化。

## Plan

1. [x] repository、database conventions、deferred constraint、既存integrationを調査する。
2. [x] mapping、catalog validation、locking、ordering helperをowner moduleへ分割する。
3. [x] same-ID-setを共通化し、`$executeRawUnsafe`を定数safe raw queryへ置換する。
4. [x] foreign bookmark IDsとconcurrent bookmark reorder/deleteのintegrationを追加する。
5. [ ] schema/canonical checks、required CIを通し、PRをmergeする。

## Progress

- 2026-08-23 16:24 JST — Started; Issue #170/#158、database conventions、repository 349行、saved-content/tenant integrationを確認。
- 2026-08-23 16:52 JST — mapper/catalog/lock/orderを分離し、repositoryを349行から222行へ縮小。unsafe rawをsafe tagged rawへ置換。
- 2026-08-23 16:58 JST — foreign/guessed/duplicate bookmark IDとreorder/delete競合を追加。deleteはfolder lock後にpositionを再取得し、stale position競合を解消。
- 2026-08-23 17:35 JST — unit 218、component 39、integration 75、saved-content integration 8、E2E 13、build、schema、securityを通過。

## Decisions

- 2026-08-23 — bulk orderingは現時点で採用せず、lock後の逐次typed updateをowner helperへ移す。
  - Reason: 対象規模を表す計測fixture/query planがなく、単一SQL化は動的VALUES構築と更新件数検証を追加する。今回の責務分割と安全raw置換は逐次方式のまま独立検証できる。
  - Alternatives: `UPDATE ... FROM VALUES`はrepresentative規模の計測Issueができた時点で再評価する。

## Risks and mitigations

- Risk: helper分割でtransaction外のqueryが混入する。
  - Mitigation: helperはすべて`Prisma.TransactionClient`を明示引数にし、integration concurrencyで検証する。
- Risk: same-ID-setがduplicate submitted IDを受け入れる。
  - Mitigation: lengthと`Set` membership/sizeを共通pure functionで検証する。
- Risk: delete/reorder競合でposition gapまたはduplicateが残る。
  - Mitigation: folderとbookmark双方で並行実行後の連番・ID集合を検証する。

## Verification

- [x] `pnpm db:schema:check`
- [x] `pnpm test:integration` — 75 passed
- [x] concurrent folder/bookmark reorder/deleteとforeign IDs — saved-content integration 8 passed
- [x] repository内`$executeRawUnsafe` 0件
- [x] `pnpm check` — unit 218、component 39、production build
- [x] `pnpm test:e2e` — 13 passed
- [x] `pnpm security:check` — vulnerabilities 0、approved licenses 314
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: helper分割、safe raw、競合/tenant検証、local required checks。
- Remaining: commit、PR、required CI、merge。
- Blocker: なし。
- Resume with: commitしてPRを作成し、exact-head required CIを確認する。

## Result

実装とローカル検証は完了。required CIとmerge待ち。
