# Issue #263: 管理画面トップを追加する

## Issue

- Issue: #263
- Branch: `codex/issue-263`

## Outcome

Basic認証で保護された `/admin` を管理画面の入口とし、主要な管理機能を選択できる。

## Constraints

- URLの秘匿性をセキュリティ境界にしない。
- 既存のBasic認証と各Server Actionの再認証を維持する。
- 既存機能のURLは変更しない。

## Plan

1. [x] `/admin` のリダイレクトをトップ画面へ置き換える。
2. [x] サイドバーにトップへの導線を追加する。
3. [x] コンポーネント・Chrome E2E・全検証を実行する。
4. [ ] 全CI成功後にPRをマージする。

## Decisions

- 2026-08-24 — `/admin` を採用する。推測困難なURLではなく認証・認可を防御境界とする。

## Risks and mitigations

- 未認証閲覧: 共通管理レイアウトのBasic認証をE2Eで回帰確認する。
- モバイル横スクロール: 390px幅のChrome E2Eで確認する。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e` — 15 passed
- [ ] Quality / Database / E2E / Security CI

## Handoff or blockers

- Completed: UI実装、コンポーネント50件、Chrome E2E 15件、全check
- Remaining: PR、CI、マージ
- Blocker: なし
- Resume with: コンポーネントテストを実行する。
