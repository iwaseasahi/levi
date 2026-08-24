# 聖書検索画面に設定メニューからログアウトを追加する

## Issue

- Issue: #249
- Branch: `codex/issue-249`
- Base commit: `51451a9`

## Outcome

聖書検索画面の右下に設定アイコンを表示し、メニューの「ログアウト」で教会セッションを終了してログイン画面へ遷移する。

## Context

- 既存の `LogoutButton` はBetter Authの `authClient.signOut()` と `/login` 遷移を行う。
- `/scripture` は画面全体をスクロールさせない固定レイアウトである。
- 旧仕様書は検索画面からlogout controlを除外しているため更新が必要。

## Constraints

- 右下固定配置で検索・投影・フォルダー操作のレイアウトを変えない。
- 新規依存関係を追加しない。
- 教会セッションのみを対象とし、管理画面のBasic認証は変更しない。

## Non-goals

- ログアウト以外の設定項目。
- 認証方式やセッション保持期間の変更。

## Plan

1. [x] keyboard・outside click対応の設定メニューを追加する。
2. [x] `/scripture` 右下へ配置し、画面契約を更新する。
3. [x] component testとChrome E2Eでmenu操作・logout・session失効を検証する。
4. [ ] 全検証と必須CIを通過させてマージする。

## Progress

- 2026-08-24 12:25 JST — Issue #249を作成し、既存logout、検索page/CSS、認証E2Eを確認した。
- 2026-08-24 12:33 JST — 設定menu、outside click、Escape focus、pending guardを実装し、component test 2件が通過した。
- 2026-08-24 12:35 JST — `pnpm check`（unit 254件、component 45件、production buildを含む）とChrome E2E 13件が通過。右下12px固定、menu color contrast、logout後のsession失効を確認した。

## Decisions

- 2026-08-24 — Decision: 設定メニューを独立したClient Componentとしてpageへ合成する。
  - Reason: 検索ロジックへ認証UI stateを混在させず、既存の検索component testと責務を分離できる。
  - Alternatives: `ScriptureSearch` 内への実装は検索状態と無関係な認証責務を増やすため採用しない。

## Risks and mitigations

- Risk: メニューが検索操作を覆う。
  - Mitigation: 右下へ小さく固定し、閉じた状態ではアイコンbuttonだけにする。E2Eでscroll-free layoutも維持する。
- Risk: logoutの多重送信。
  - Mitigation: pending中はmenu itemをdisabledにする。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [x] 最終差分をauth、keyboard/focus、scope、秘密情報の観点で確認する。

## Handoff or blockers

- Completed: Issue、component、CSS、仕様書、component/E2E、ローカル検証。
- Remaining: PR、CI、merge。
- Blocker: なし。
- Resume with: 最終差分をcommitしてPRを作成する。

## Result

実装とローカル検証は完了。PRと必須CIを待つ。
