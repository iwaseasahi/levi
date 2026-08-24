# Issue #267: Basic認証の仮管理者を一覧から除外する

## Issue

- Issue: #267
- Branch: `codex/issue-267`

## Outcome

Basic認証の内部レコードを認証・監査用途として維持しつつ、管理者一覧には実際に管理する管理者だけを表示する。

## Plan

1. [x] 管理者一覧の取得対象から `BOOTSTRAP` を除外する。
2. [x] 表示コンポーネントでも `BOOTSTRAP` を除外する。
3. [x] 実管理者がいない場合の空表示を追加する。
4. [x] コンポーネント・Chrome E2E・全checkを実行する。
5. [ ] 全CI成功後にPRをマージする。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [ ] Quality / Database / E2E / Security CI

## Handoff or blockers

- Completed: 実装、ローカル検証
- Remaining: PR、CI、マージ
- Blocker: なし
- Resume with: PRを作成して必須CIを確認する。
