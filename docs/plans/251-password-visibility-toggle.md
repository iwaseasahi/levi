# パスワード入力欄に表示切替を追加する

## Issue

- Issue: #251
- Branch: `codex/issue-251`
- Base commit: `2893d79`

## Outcome

ログイン画面と一時パスワード変更画面で、目のアイコンから入力中のパスワードを表示・非表示に切り替えられる。

## Context

- `src/app/login/login-form.tsx` に現在のパスワード入力欄がある。
- `src/app/change-password/change-password-form.tsx` に新しいパスワードと確認入力欄がある。
- 両画面は `src/app/styles/auth-admin.css` の共通フォームスタイルを使う。

## Constraints

- 入力値、`name`、autocomplete、validation、送信処理を変更しない。
- 初期状態は非表示とし、切替状態をフォーム送信データや永続領域へ保存しない。
- buttonはキーボード操作と読み上げに対応し、pending中はfieldsetとともに無効になる。

## Non-goals

- 管理画面で発行した一時パスワードの結果表示。
- パスワード要件、認証方式、セッションの変更。

## Plan

1. [x] 共通のパスワード入力・表示切替コンポーネントを実装する。
2. [x] ログイン画面と一時パスワード変更画面へ適用する。
3. [x] component testとChrome E2Eで初期状態、切替、値保持、送信を検証する。
4. [ ] 全検証と必須CIを通過させてマージする。

## Progress

- 2026-08-24 — Issue #251を作成し、対象フォーム、スタイル、既存テストを確認した。
- 2026-08-24 — uncontrolled inputを維持した共通表示切替componentを両画面へ適用した。
- 2026-08-24 13:09 JST — `mise run check`（unit 254件、component 46件、production buildを含む）とChrome E2E 13件が通過した。

## Decisions

- 2026-08-24 — Decision: パスワード値はReact stateへ移さず、表示状態だけをcomponent内で管理する。
  - Reason: 既存のフォーム送信契約を維持し、機密値の不要な複製を避ける。
  - Alternatives: 各フォームで個別実装すると挙動とアクセシビリティが分岐するため採用しない。

## Risks and mitigations

- Risk: 表示切替で入力値が消える、または送信値が変わる。
  - Mitigation: component testとChrome E2Eで切替前後の値と送信を検証する。
- Risk: 同じ画面の2入力欄を読み上げ利用者が区別できない。
  - Mitigation: 各ラベルに対応した個別のaccessible nameと`aria-pressed`を付ける。

## Verification

- [x] `mise run check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [ ] 最終差分を認証、アクセシビリティ、秘密情報、scopeの観点で確認する。

## Handoff or blockers

- Completed: Issue、共通component、両フォームへの適用、CSS、component/E2E、ローカル検証。
- Remaining: PR、CI、merge。
- Blocker: なし。
- Resume with: 最終差分をcommitしてPRを作成する。

## Result

実装とローカル検証は完了。PRと必須CIを待つ。
