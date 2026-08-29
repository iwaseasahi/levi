# 統合テストのメール配送を破棄する

## Issue

- Issue: #372
- Branch: `codex/issue-372`
- Base commit: `2a202b9c07c627eaaedc305f86770d2f03a37ec9`

## Outcome

統合テストがBetter Authのverification token生成を検証しながら、開発用Mailpitや
外部SMTPへメールを配送しない。

## Context

- 統合テストsetupが開発用MailpitのSMTPポート`1125`を利用している。
- 教会作成と教会利用者招待の成功ケースが、開発者向け受信箱へ合成メールを残す。
- E2Eはメール本文とリンクを検証するため、専用の使い捨てMailpitを引き続き使う。

## Constraints

- developmentとproductionのSMTP配送を変更しない。
- 統合テストからSMTP接続を行わない。
- ambientなSMTP認証情報を統合テストへ継承しない。
- verification tokenとDB状態の統合検証は維持する。

## Non-goals

- E2E専用Mailpitの廃止。
- 開発用Mailpitの既存メール削除。
- production Gmail設定の変更。

## Plan

1. [completed] test限定の配送破棄モードとfail-closedな設定検証を追加する。
2. [completed] 統合テストrunnerから配送破棄モードを強制し、ambient SMTPを除去する。
3. [completed] unit、静的構成チェック、testing documentationを更新する。
4. [completed] Mailpit件数不変、integration、canonical checksを検証する。
5. [in_progress] PRを作成し、required CI通過後にmergeする。

## Progress

- 2026-08-29 JST — Issue #372を作成。統合テストsetupが開発用Mailpitへ
  `SMTP_HOST=127.0.0.1`、`SMTP_PORT=1125`で配送していることを特定した。
- 2026-08-29 JST — `NODE_ENV=test`限定の`discard` delivery modeを追加し、
  integration runnerからSMTP設定と認証情報を除去した。
- 2026-08-29 JST — 統合テスト前後の開発用Mailpit件数が`5 -> 5`で不変であること、
  integration 84件、unit 301件、component 65件を含むcanonical checksを確認した。

## Decisions

- 2026-08-29 — 統合テストではSMTPの代わりにtest限定の配送破棄モードを使う。
  - Reason: Better Authのtoken生成を維持したまま、ネットワーク配送を完全に止められる。
  - Alternatives: 専用Mailpitは本文を検証しない統合テストには不要で、開発用Mailpitの
    事後削除は開発者のメールを誤って消す危険があるため採用しない。

## Risks and mitigations

- Risk: 破棄モードがdevelopmentやproductionで誤用される。
  - Mitigation: `NODE_ENV=test`以外では設定parse時に拒否する。
- Risk: ambientなSMTP認証情報がtest subprocessへ残る。
  - Mitigation: integration test environmentで配送モードと送信元を固定し、認証情報を除去する。

## Verification

- [x] mail configとtest environment unit tests — 3 files / 38 tests passed
- [x] `pnpm local:config:check` — passed
- [x] `pnpm test:integration` — 18 files / 84 tests passed
- [x] 開発用Mailpitの件数が統合テスト前後で不変 — `5 -> 5`
- [x] `pnpm check` — unit 301、component 65、buildを含めpassed
- [x] `pnpm security:check` — vulnerabilities 0、approved licenses 315
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: 原因調査、実装、Mailpit隔離確認、canonical verification。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: PRを作成し、required CIを確認する。
