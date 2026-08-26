# Issue #259: Basic 認証を維持した管理者個別ログイン

> Historical plan. Issue #341 replaces the custom administrator credential and
> session implementation with a separate Better Auth realm while retaining the
> outer Basic authentication boundary.

## Goal

`/admin` 全体の Basic 認証を維持し、その内側に `admin_users` の個別ログイン、30日セッション、初回パスワード変更、ログアウトを追加する。

## Plan

- [x] Issue の要件を今回の二重認証方針へ更新する
- [x] 管理者セッションのDB制約と失効モデルを追加する
- [x] ログイン、初回パスワード変更、ログアウトのサーバー境界を実装する
- [x] 管理画面のページとServer Actionを個別セッションで保護する
- [x] レート制限、監査ログ、認証UIを実装する
- [x] 単体・コンポーネント・統合・E2Eテストを追加する
- [x] セキュリティ・運用文書を更新する
- [x] 全チェックと独立レビューを完了し、PRのCI成功後にマージする

## Security invariants

- Basic 認証を通らなければログイン画面にも到達できない。
- Cookie に生トークンを置き、DBには SHA-256 ハッシュだけを保存する。
- Cookie は host-only、HttpOnly、SameSite=Lax、production では Secure とする。
- `INVITED` は初回パスワード変更とログアウト以外を実行できない。
- `SUSPENDED`、期限切れ、削除済みの管理者セッションは毎回拒否する。
- パスワード、Cookie、生トークン、ログインIDは監査ログへ出力しない。

## Verification

- `mise exec -- pnpm test:unit`
- `mise exec -- pnpm test:component`
- `mise exec -- pnpm test:integration`
- `mise exec -- pnpm test:e2e`
- `mise exec -- pnpm check`
- `mise exec -- pnpm security:check`
