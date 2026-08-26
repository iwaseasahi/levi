# Issue #258: 管理者を招待できるようにする

> Historical plan. Issue #341 supersedes the temporary-password and no-email
> decisions below. Current invitations use Better Auth password setup links sent
> through Gmail in production and captured by Mailpit locally.

## Issue

- Issue: #258
- Branch: `codex/issue-258`

## Outcome

Basic 認証で保護された管理画面から、教会利用者とは独立した管理者IDを招待し、状態を一覧で確認できる。

## Constraints

- 招待された管理者の個別ログインは #259 まで有効化しない。
- 一時パスワードはハッシュだけを保存し、成功画面で一度だけ表示する。
- メール送信は行わない。
- Server Action はレイアウトとは独立して Basic 認証を再検証する。

## Plan

1. [x] 招待入力・ユースケース・永続化アダプターを実装する。
2. [x] 管理者一覧と招待フォームを実装する。
3. [x] 単体・コンポーネント・結合・E2Eテストを追加する。
4. [ ] 文書を更新し、全検証とCIを通す。

## Progress

- 2026-08-24 14:34 JST — 招待、一覧、一度限りの資格情報表示を実装。
- 2026-08-24 14:34 JST — `pnpm check`、結合80件、Chrome E2E 14件が成功。

## Decisions

- 2026-08-24 — ログインIDは小文字へ正規化し、半角英数字と `._@-` のみを許可する。
- 2026-08-24 — 招待はメールではなく、一時パスワードを運営者へ一度だけ表示する。

## Risks and mitigations

- 平文パスワードの残存: DBにはBetter Authのハッシュだけを保存し、ログ属性には含めない。
- Server Actionの直接呼び出し: Action内のControllerで毎回Basic認証を再検証する。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [ ] Quality / Database / E2E / Security CI

## Handoff or blockers

- Completed: 実装、ローカル検証、運用手順更新
- Remaining: PR作成、CI、マージ
- Blocker: なし
- Resume with: 招待ユースケースを実装する。
