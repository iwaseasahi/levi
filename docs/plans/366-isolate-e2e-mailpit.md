# E2Eメールを開発用Mailpitから分離する

## Issue

- Issue: #366
- Branch: `codex/issue-366`
- Base commit: `5b5c5369e019650f52bd9e2b95dbad1f0e4210cb`

## Outcome

ローカルE2Eが専用の使い捨てMailpitだけを利用し、開発者が
`http://localhost:8026` で確認する受信箱へテストメールを残さない。

## Context

- `compose.development.yaml` は現在、開発用Mailpitを `1125/8026` で公開する。
- `scripts/run-e2e-tests.ts` と `tests/e2e/operator-provisioning.spec.ts` も同じ
  SMTP/APIポートを利用するため、合成テストメールが開発用受信箱に残る。
- E2Eは招待・パスワード再設定リンクをメール本文から取得するため、SMTP境界を
  スタブ化すると重要な回帰検知能力が失われる。

## Constraints

- 外部SMTPへE2Eメールを配送しない。
- 開発用Mailpitの内容をE2Eから削除・変更しない。
- E2E失敗時にも専用Mailpitと受信内容を破棄する。
- productionメール設定は変更しない。

## Non-goals

- メール送信処理のスタブ化。
- 開発用Mailpitのポート変更。
- production SMTPの変更。

## Plan

1. [x] Composeとtest runnerにE2E専用Mailpitの起動・必須cleanupを追加する。
2. [x] E2EのMailpit API参照を専用URLへ切り替える。
3. [x] CI、ローカル構成チェック、testing documentationを更新する。
4. [x] E2E前後で開発用受信箱が不変であることとcanonical checksを検証する。

## Progress

- 2026-08-29 JST — Issue #366を作成し、現行のCompose、runner、E2Eメール取得、
  CI service、testing documentationを調査した。
- 2026-08-29 JST — E2E専用Mailpitを `1126/8027` で追加し、runnerが外部SMTPの
  認証情報を継承せず、成功・失敗を問わず専用コンテナを削除するようにした。
- 2026-08-29 JST — E2E 18件、integration 84件、canonical check、security checkを
  完走し、開発用Mailpitのメッセージ件数が50件のまま不変であることを確認した。

## Decisions

- 2026-08-29 — E2E専用の使い捨てMailpitを使用する。
  - Reason: SMTP送信とメール本文の統合検証を維持しつつ、開発用受信箱を分離できる。
  - Alternatives: メール送信の完全stubはSMTP統合を検証できず、共有受信箱の事後削除は
    開発者のメールを誤って削除する危険があるため採用しない。

## Risks and mitigations

- Risk: テスト失敗時に専用コンテナが残る。
  - Mitigation: runnerの `finally` で専用サービスを停止・削除し、受信内容も破棄する。
- Risk: CIとローカルでMailpitポートがずれる。
  - Mitigation: 同じ専用ポートを使用し、静的構成チェックで固定する。

## Verification

- [x] `pnpm local:config:check`
- [x] `pnpm test:e2e` — 18 passed
- [x] 開発用Mailpitのメッセージ件数がE2E前後で不変 — 50件 → 50件
- [x] E2E終了後に専用Mailpitコンテナが残らない
- [x] `pnpm check`
- [x] `pnpm test:integration` — 84 passed
- [x] `pnpm security:check` — vulnerabilitiesなし、315 license records承認済み
- [x] `git diff --check`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: 実装とローカル検証。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: PRを作成しrequired CIを確認する。

## Result

E2Eメールは使い捨ての専用Mailpitだけへ配送される。通常の開発用Mailpit受信箱と
外部SMTPはE2Eから隔離され、専用Mailpitの受信内容はテスト終了時に破棄される。
