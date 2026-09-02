# 教会利用者が確認付きでログイン用メールアドレスを変更できるようにする

## Issue

- Issue: #457
- Branch: `codex/issue-457`
- Base commit: `ee9dad6de90edf0260dc702168d9a90b95909eab`

## Outcome

ログイン済みの教会利用者が、現在のパスワードで本人確認し、新しいメールアドレスへ届く期限付きリンクを開いてログイン用メールアドレスを変更できる。

## Context

- 教会利用者は Better Auth の credential account と Prisma の `User.email` を利用している。
- `User.email` は PostgreSQL `citext` の unique column で、大文字小文字を区別せず一意である。
- 設定メニューには現在パスワード変更だけがある。
- Better Auth の確認リンク処理は署名済み change-email token を検証し、ユーザーと session のメールアドレスを更新できる。

## Constraints

- 教会利用者 realm だけを対象にし、現在のパスワード、session、Origin、入力値、レートを検証する。
- 確認リンクを開くまで旧メールアドレスを維持する。
- メールアドレス、パスワード、token をログやテスト成果物へ出さない。
- production deployment と production data 操作は対象外とする。

## Non-goals

- 管理者メールアドレス変更
- メール送信 provider の変更
- production deploy

## Plan

1. [x] メール変更申請の入力検証、再認証、重複検査、rate limit、確認 token とメール送信を実装する。
2. [x] session/Origin を守る API と、設定メニュー・変更画面・各 UI state を実装する。
3. [x] unit/component/integration/E2E と運用・テスト文書を更新する。
4. [ ] canonical checks、差分レビュー、PR/CI/merge を完了する。

## Progress

- 2026-09-02 09:00 JST — Issue、governance、実行 protocol、Next.js authentication/mutation guide、既存認証・メール・UI・テスト構成を確認した。
- 2026-09-02 12:31 JST — API、画面、1時間 token、SMTP、1利用者5回/時の rate limit を実装。`pnpm test:e2e`: 33 passed。
- 2026-09-02 12:34 JST — `pnpm check` と coverage（93.38% statements / 86.27% branches）成功。`pnpm test:integration`: 25 files / 130 tests passed。
- 2026-09-02 12:34 JST — `pnpm security:check` は既存 lockfile の `mysql2@3.15.3` に新規 high advisory GHSA-3f6p-5ww8-9rcr を検出。機能差分と分離して解消する。

## Decisions

- 2026-09-02 — Decision: 変更申請時に現在のパスワードを検証し、Better Auth と互換性のある署名済み確認 token を新アドレスへ送る。
  - Reason: 確認完了まで旧アドレスを保持しつつ、既存の token 検証と session 更新を再利用できる。
  - Alternatives: Better Auth の公開 change-email endpoint を直接有効化する案は、現在のパスワード入力を必須にできないため採用しない。

## Risks and mitigations

- Risk: 盗まれた session や CSRF による認証識別子変更。
  - Mitigation: church session、同一 Origin、現在パスワード、新アドレス所有確認、rate limit をすべて必須にする。
- Risk: 重複アドレスや送信失敗で旧アドレスが失われる。
  - Mitigation: 申請時には DB を更新せず、確認時の unique constraint を最終防壁にする。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [ ] `pnpm security:check`
- [x] 未認証、Origin 不正、パスワード不一致、重複、期限付き確認前後を自動テストする。
- [ ] 最終差分を scope、secret、migration、unsafe default の観点でレビューする。

## Handoff or blockers

- Completed: 実装、unit/component/integration/E2E、build、coverage。
- Remaining: transitive dependency advisory の分離解消、Security 再実行、PR、CI、merge。
- Blocker: `mysql2@3.15.3` の high advisory により Security gate が失敗する。
- Resume with: follow-up Issue で `mysql2` を修正版へ固定して main に取り込み、本 branch を更新する。

## Result

作業完了時に更新する。
