# Saved content と folder editor の責務を分割する

## Issue

- Issue: #165
- Branch: `codex/issue-165`
- Base commit: `b843237`

## Outcome

フォルダー・お気に入りの取得、mutation、recovery、並べ替え、portal、表示を独立した責務へ分け、現行操作を維持する。

## Context

- `saved-content-panel.tsx` は454行、`folder-edit-panel.tsx` は306行で network/state/drag/DOM を同時に所有する。
- #163 で typed client と共通 order primitive、#164 で UI hook/view 分割の先行パターンを導入済み。
- component、integration、E2E が現行仕様を固定している。

## Constraints

- folder作成・開閉・固定・最近使用・物理削除・同一タブ編集・並べ替えを変更しない。
- bookmark名編集を復活させず、DB/API/UI designを変更しない。
- injected fetcher は component lifetime で固定し、lint抑制を残さない。

## Non-goals

- DB ordering、route、CSS、文言の変更。
- production dependency の追加。

## Plan

1. [x] saved-content request/state/mutation/recoveryをcontroller hookへ分離する。
2. [x] sidebarとfavorite portalを明示的なview/component境界へ分離する。
3. [x] folder editor request/state/mutationをcontroller hook、DOMをviewへ分離する。
4. [x] drag/keyboard reorderを共通order primitive経由に統一してテストする。
5. [x] folder editorのloading/error/success/delete状態をcomponent testで固定する。
6. [ ] component/integration/E2E/axe/screenshot、`pnpm check`、security、required CIを通す。

## Progress

- 2026-08-23 JST — Issue、依存Issue、現行component/test、#163/#164の境界を確認。
- 2026-08-23 JST — saved-content と folder editor の request/state/mutation/recovery を専用hookへ移し、favorite portalを独立component化。既存componentからlint抑制を除去。
- 2026-08-23 JST — folder editorのloading/error focus/update success/bookmark delete/folder deleteをcomponent testで固定。unit 195件、component 38件、integration 73件、E2E 9件が合格。
- 2026-08-23 JST — axe violations 0を維持し、synthetic E2E screenshot `test-results/saved-content-refactor-165.png` を1280x720で目視確認。

## Decisions

- 2026-08-23 — network/state/recoveryはcontroller hook、dragの一時UI状態とDOMはviewに置く。
  - Reason: 永続状態の所有者とブラウザevent表現を分け、API失敗時のrecoveryを一箇所で保証できる。

## Risks and mitigations

- Risk: mutation失敗後にopen folderが古い順序を表示する。
  - Mitigation: controllerのreorder commandが従来どおりfolder reloadをrecoveryとして実行する。
- Risk: portal targetのhydration差異。
  - Mitigation: dedicated portal componentが`useSyncExternalStore`でclient targetだけを解決する。

## Verification

- [x] `pnpm test:component` — 38 passed
- [x] `pnpm test:integration` — 73 passed
- [x] `pnpm test:e2e` — 9 passed
- [x] axe / synthetic screenshot — violations 0、1280x720目視確認
- [x] `pnpm check` — pass
- [x] `pnpm security:check` — pass
- [x] `git diff --check` — pass
- [ ] required CI

## Handoff or blockers

- Completed: 実装、ローカル検証、E2E screenshot、final diff review。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: saved-content controller hook を抽出する。

## Result

ローカル検証済み。required CI と merge 待ち。
