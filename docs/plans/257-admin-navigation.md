# Issue #257: 管理画面のナビゲーションと画面分割

## Outcome

Basic 認証を維持し、管理画面を共通サイドバーと目的別の画面へ整理する。

## Routes

- `/admin/churches/new`: 教会を作成
- `/admin/churches/password-reset`: パスワードを再設定
- `/admin/admin-users`: 管理者

## Verification

- component test
- administration E2E
- `pnpm check`
