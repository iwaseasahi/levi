# Issue #256: admin_users を導入して管理者IDを分離する

## Outcome

Basic 認証を維持したまま、管理操作の主体を教会利用者の `users` から独立した `admin_users` へ移す。

## Steps

1. 前方マイグレーションと Prisma model を追加する。
2. bootstrap 管理者の seed と Basic 認証アダプターを切り替える。
3. 教会作成・パスワード再設定・監査イベントを admin user ID に切り替える。
4. 教会利用者の session eligibility から管理者分岐を撤去する。
5. DB・認証・管理操作のテストと設計文書を更新する。

## Verification

- `pnpm db:check`
- `pnpm test:integration`
- `pnpm check`
- `pnpm test:e2e`
