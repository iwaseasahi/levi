# 新規フォルダーを先頭へ追加する

## Issue

- Issue: #374
- Branch: `codex/issue-374`
- Base: `4439dbc1e8f1a922fc5c00269d59749dc3acdae7`

## Outcome and constraints

新規作成時に保存順の先頭へ挿入し、再読込でも維持する。既存の相対順、
固定優先、教会分離、20件上限、選択時に並べ替えない挙動を維持する。
日付ソート、既存データのmigration、本番deployは対象外。

## Context and decisions

- `saved-content-repository.ts` の作成処理が件数をpositionへ指定し末尾に追加していた。
- UIは作成後にAPIを再取得するので、DBの保存順だけを変更する。
- ADR 0007のChurch行ロックと遅延unique制約を使い、同一transaction内で
  既存positionを1増やしてposition 0に作成する。他教会の行は変更しない。
- 既存の固定優先は撤去せず、固定がある場合は非固定グループの先頭とする。

## Plan

1. [x] Issueと既存保存順、UI再取得、制約を確認する。
2. [x] atomicな先頭挿入と回帰テスト、仕様記述を追加する。
3. [x] 統合・E2E・canonical checksを実行し別レビューで差分を確認する。
4. [ ] PRの必須CIが全通過した後にmergeしてIssueをcloseする。

## Verification

- 統合: 空一覧、日付に依存しない作成順、既存手動順、教会分離、20件上限、
  固定優先、同時作成の連続位置。
- E2E: 作成直後・reload後の新規先頭、既存フォルダー選択で順序が不変。
- `DATABASE_URL=postgresql://localhost/levi SHADOW_DATABASE_URL=postgresql://localhost/levi_shadow mise exec -- pnpm check`: pass（format/lint/typecheck/unit/component/config/build）。
- `mise exec -- pnpm test:integration`: 18 files / 87 tests pass。
- `mise exec -- pnpm test:e2e`: Chromium 18 tests pass。
- `mise exec -- pnpm security:check`: vulnerabilitiesなし、315 license records承認済み。
- `git diff --check`: pass。

## Progress

- 2026-08-30 JST: 調査と実装を完了。検証を開始する。
- 初回checkはworktreeに.envがないためPrisma設定のDATABASE_URL不足で停止。
  非接続用の検証URLを明示して再実行した。追加テストの配列アクセス4箇所の型エラーも
  安全な存在チェックとobject assertionに修正し、checkと統合テストを再実行して通過。
- 別パスの自己レビューでChurch行ロック、遅延unique制約、transaction rollback、
  他教会への非影響、表示上限、pin優先を確認。schema変更や既存本文の変更なし。
- 必須CIのexact HEAD通過とmerge確認はPRで記録する。本番deployは行わない。

## Risks

作成時に同一教会のpositionを更新するため競合があり得る。既存Church行ロックと
同時作成の実DBテストで担保する。既存フォルダー本文・お気に入りは変更しない。
