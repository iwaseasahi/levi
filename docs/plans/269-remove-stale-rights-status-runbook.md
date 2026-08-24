# Issue #269: 本番移行runbookから旧rightsStatus手順を撤去する

## Issue

- Issue: #269
- Branch: `codex/issue-269`

## Outcome

本番移行文書と機械検証される切り替え計画から、撤去済みのDB権利ステータスを有効化する手順を削除する。聖書の表示許可はDB状態ではなく、外部の承認済みリリース記録で確認する。

## Plan

1. [x] Bible import runbookから権利ステータス有効化の前提を削除する。
2. [x] 初回切り替え手順と停止条件を現行仕様へ合わせる。
3. [x] パリティ表と機械検証用停止条件を更新する。
4. [x] 文書検索、release planテスト、全checkを実行する。
5. [ ] 全CI成功後にPRをマージする。

## Verification

- [x] `pnpm release:checklist:dry-run`
- [x] `pnpm check`
- [ ] Quality / Database / E2E / Security CI

## Handoff or blockers

- Completed: 文書と切り替え計画の更新、ローカル検証
- Remaining: PR、CI、マージ
- Blocker: なし
- Resume with: PRを作成して必須CIを確認する。
