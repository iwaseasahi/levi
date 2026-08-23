# Bookmark drag E2Eをpending解除へ同期する

## Issue

- Issue: #186
- Parent: #158
- Blocks: #184
- Branch: `codex/issue-186`
- Base commit: `77ee8ca`

## Outcome

saved-content E2Eがbookmark作成の非同期refresh完了をobservableな`draggable=true`で待ち、retry 0でdrag/keyboard reorderを決定的に検証する。

## Context

- #184のE2E連続3回目でdrag後も順序が変わらなかった。
- 2件目bookmarkは`loadFolder()`後に表示されるが、続く`fetchFolders()`完了までcontrollerはpendingで、`li`は`draggable=false`、dragStart handlerも処理しない。
- testはbookmark数/属性を待たず、作成click直後に`dragTo()`していた。

## Constraints

- production code、API、drag/keyboard仕様を変更しない。
- sleep、timeout延長、Playwright retryを追加しない。

## Non-goals

- saved-content UI/DBの変更、E2E scenario再分割。

## Plan

1. [x] artifactとcomponent pending lifecycleからroot causeを特定する。
2. [x] 2行の表示と`draggable=true`を待ってからdragする。
3. [ ] 対象/full E2Eをretry 0で連続実行しcanonical checks/CI後にmergeする。

## Progress

- 2026-08-23 16:53 JST — Started; 失敗trace、test、component/controllerを確認しpending途中状態を特定。
- 2026-08-23 16:56 JST — bookmark 2行と両方の`draggable=true`を待つ同期を追加。full E2E 13/13を3回連続成功。
- 2026-08-23 16:57 JST — `pnpm check`（unit 227、component 39、build）とsecurityを通過。

## Decisions

- 2026-08-23 — testを既存のobservable readinessへ同期し、product stateを変更しない。
  - Reason: UIはpending中のmutation重複を正しく禁止している。問題はtestが表示更新とmutation完了を同一視したこと。

## Risks and mitigations

- Risk: 属性待ちがdrag結果を検証しない見かけの修正になる。
  - Mitigation: drag後とkeyboard後の既存順序assertionを維持する。

## Verification

- [x] saved-content E2E — 3回連続成功内で検証
- [x] full `pnpm test:e2e` 3回連続 — 各13 passed、retry 0
- [x] `pnpm check` — unit 227、component 39、production build
- [x] `pnpm security:check` — vulnerabilities 0、approved licenses 314
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: root-cause、observable synchronization、local verification。
- Remaining: commit、PR、CI、merge。
- Blocker: なし。
- Resume with: commitしてPRを作成しrequired CIを確認する。

## Result

実装とローカル検証は完了。required CIとmerge待ち。
