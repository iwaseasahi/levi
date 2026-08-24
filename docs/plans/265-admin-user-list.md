# Issue #265: 管理者一覧を専用画面へ分離する

## Issue

- Issue: #265
- Branch: `codex/issue-265`

## Outcome

`/admin/admin-users` で管理者の一覧を確認でき、招待は `/admin/admin-users/new` で行う。

## Constraints

- Basic認証とServer Actionの再認証を維持する。
- 管理者個別ログインは #259 まで有効化しない。

## Plan

1. [x] 管理者一覧を表示コンポーネントへ分離する。
2. [x] 招待フォームを専用URLへ移す。
3. [x] サイドバーと管理画面トップの文言・導線を更新する。
4. [x] コンポーネント・Chrome E2E・全checkを実行する。
5. [ ] 全CI成功後にPRをマージする。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [ ] Quality / Database / E2E / Security CI

## Handoff or blockers

- Completed: 画面分離、ローカル検証
- Remaining: PR、CI、マージ
- Blocker: なし
- Resume with: PRを作成して必須CIを確認する。
