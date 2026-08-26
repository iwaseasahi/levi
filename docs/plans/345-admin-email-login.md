# 管理者ログインをメールアドレスへ一本化する

## Issue

- Issue: #345
- Branch: `codex/issue-345`
- Base commit: `3c68b5ad19987f265f2b20d387dfc346b80cd779`

## Outcome

管理者は招待時に登録したメールアドレスとパスワードでログインし、独立したログインIDを入力・管理しない。

## Context

- `src/infrastructure/auth/admin-options.ts` は専用Better Auth realmでemail/passwordを有効化しつつ、username pluginを`AdminUser.loginId`へ割り当てている。
- `admin_accounts.account_id`は管理者UUIDであり、Better Auth標準のemail sign-inへ切り替えても既存password hashを利用できる。
- `admin_users.email`はCITEXT uniqueである。
- ADR 0012は管理者専用Better Auth realmとメールによる招待・resetを採用している。

## Constraints

- Basic認証の外側境界と教会利用者realmは変更しない。
- merged migrationは変更せずforward migrationを追加する。
- 既存の実在メール管理者のpassword accountを保持する。
- placeholder `@pending.invalid` 管理者は実在メール管理者を有効化してから削除する既存runbookを維持する。

## Non-goals

- Basic認証の撤去
- 管理者メールアドレス変更UI
- 教会利用者認証、MFA、送信基盤の変更

## Plan

1. [x] username pluginを撤去し、管理者ログインをBetter Auth標準email sign-inへ変更する。
2. [x] 招待application/store/UIからloginIdを撤去する。
3. [x] forward migrationで`admin_users.login_id`をnullableな互換列へ移し、schema/dictionaryを更新する。
4. [x] unit/component/integration/E2Eをメールログイン仕様へ更新する。
5. [ ] canonical checksとmigration rehearsalを通し、PR/CIを完了する。

## Progress

- 2026-08-27 01:45 JST — Issue #345を作成。現行Better Auth、招待、schema、migrationを確認した。
- 2026-08-27 — Better Auth標準email sign-inへ切り替え、招待・一覧・schemaからloginId依存を撤去した。
- 2026-08-27 — unit/component/integration/E2Eをメールログイン仕様へ更新した。
- 2026-08-27 — rollback観測期間後の物理列削除をfollow-up Issue #346へ分離した。
- 2026-08-27 — commit `bc0259c`に対するCI run 32991218798でQuality、Database、E2E、Securityがすべて成功した。
- 2026-08-27 — follow-up Issue #346でrollback互換期間を終了し、deprecatedな`admin_users.login_id`物理列を削除した。

## Decisions

- 2026-08-27 — Decision: email値をusernameへ複製せず、Better Auth標準`signIn.email`を使用する。
  - Reason: email/passwordは既に有効で、重複する識別子・検証・一意制約を廃止できる。
  - Alternatives: `loginId=email`を隠して保存する案は同じ値を二重管理するため不採用。
  - ADR: `docs/architecture/0012-admin-better-auth-email.md`
- 2026-08-27 — Decision: `login_id`物理列は今回nullableなdeprecated互換列としてschemaに残し、application codeからの読み書きを止めた上でrollback期間後に別migrationで削除する。
  - Reason: migration適用中に旧applicationが稼働するproduction deploy順序との互換性を保つため。
  - Follow-up: rollback互換期間の終了後、Issue #346のforward migrationで物理削除した。

## Risks and mitigations

- Risk: placeholder emailしか持たない旧管理者がメールログインへ切り替えられない。
  - Mitigation: 実在メール管理者を招待・有効化してから旧placeholder管理者を削除するrunbookとdeploy前確認を維持する。
- Risk: username endpoint用rate limitからemail endpointへ切り替わる。
  - Mitigation: `/sign-in/email`へ同等のDB rate limitを設定しintegration testで確認する。

## Verification

- [x] `pnpm test:unit`
- [x] `pnpm test:component`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm build`
- [x] `pnpm check`
- [x] migration rehearsal
- [x] final diff review

## Handoff or blockers

- Completed: Issue、実装、unit/component/integration/E2E、migration rehearsal、canonical check。
- Remaining: PR、CI、merge。
- Blocker: なし。
- Resume with: PRを作成する。

## Result

未完了。
