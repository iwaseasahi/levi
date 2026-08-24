# フォルダー編集画面から固定操作を非表示にする

## Issue

- Issue: #247
- Branch: `codex/issue-247`
- Base commit: `fbc5e2b`

## Outcome

フォルダー編集画面には固定操作を表示せず、名前を変更しても既存の固定状態を保持する。

## Context

- UIは `src/app/church/folder-edit-panel.tsx` にある。
- `useFolderEditor` は画面のcheckbox stateを更新APIへ送っている。
- 固定機能、API、DB、一覧の固定表示は残す。

## Constraints

- UIからのみ固定操作を外す。
- 保存済みの `isPinned` を名前変更で上書きしない。
- 新規依存関係とDB変更は行わない。

## Non-goals

- 固定機能の廃止。
- フォルダー一覧の並び順・固定バッジ変更。

## Plan

1. [x] 編集画面から固定checkboxと専用styleを削除する。
2. [x] editorが読み込んだ固定状態を名前変更時にそのまま送るようにする。
3. [x] component/E2Eを非表示・状態保持の仕様へ更新する。
4. [ ] 全検証と必須CIを通過させてマージする。

## Progress

- 2026-08-24 12:14 JST — Issue #247を作成し、UI・hook・component/E2Eの現行契約を確認した。
- 2026-08-24 12:17 JST — 固定操作と専用CSSを削除し、固定済みfixtureの名前変更payloadが `isPinned: true` を保持するcomponent test 2件が通過した。
- 2026-08-24 12:18 JST — Chrome E2E 13件と `pnpm check`（unit 254件、component 43件、production buildを含む）が通過した。

## Decisions

- 2026-08-24 — Decision: checkbox用の独立stateを削除し、更新時は読み込んだfolderの `isPinned` を送信する。
  - Reason: 操作UIをなくした後も、名前変更によって既存の固定状態が失われることを防ぐ。
  - Alternatives: APIから `isPinned` を省略する案はupdate contract変更を伴うため採用しない。

## Risks and mitigations

- Risk: 固定済みフォルダーの名前変更で固定が解除される。
  - Mitigation: `isPinned: true` のfixtureで更新payloadがtrueのままになるcomponent testを設ける。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `git diff --check`
- [x] 最終差分をscope、秘密情報、unsafe default、不要CSSの観点で確認する。

## Handoff or blockers

- Completed: Issue、UI・hook・test、ローカル検証。
- Remaining: PR、CI、merge。
- Blocker: なし。
- Resume with: commitしてPRを作成する。

## Result

実装とローカル検証は完了。PRと必須CIを待つ。
