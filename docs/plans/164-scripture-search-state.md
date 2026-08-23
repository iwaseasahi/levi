# ScriptureSearch の状態管理と表示を分割する

## Issue

- Issue: #164
- Branch: `codex/issue-164`
- Base commit: `2aad19e`

## Outcome

聖書検索画面の catalog/selection、投影タブ制御、表示責務を独立してテストできる境界へ分割し、Ginmaku 互換の見た目と操作を維持する。

## Context

- `src/app/church/scripture-search.tsx` は 597 行で、catalog request、selection normalization、popup lifecycle、validation、全 JSX を保持している。
- `src/app/church/scripture-search.component.test.tsx` と `tests/e2e/scripture-search.spec.ts` が現在のユーザー操作を固定している。
- Next.js 16.3.1 同梱の `use client` 文書を確認済み。

## Constraints

- Open / Reset / 空白切替、直接投影、popup recovery、validation 文言、URL、CSS class を変更しない。
- injected fetcher は component lifetime で固定し、catalog の古い response を破棄する。
- lint 抑制を追加しない。

## Non-goals

- デザイン、route、API、saved-content 内部の変更。
- 新しい production dependency の導入。

## Plan

1. [x] selection normalization と catalog 状態を reducer/hook に分離し、競合防止を維持する。
2. [x] audience window lifecycle と postMessage を controller hook に分離する。
3. [x] 検索 fieldset と feedback を presentation component に分離する。
4. [x] loading/empty/error/disabled/keyboard/popup recovery の component coverage を確認・補強する。
5. [x] component、E2E、axe、screenshot、`pnpm check`、required CI を通す。

## Progress

- 2026-08-23 JST — Issue、依存 Issue、governance、testing strategy、Next.js `use client` 文書、現行 component/test を確認。
- 2026-08-23 JST — `ScriptureSearch` を 597 行から 123 行へ縮小し、selection/catalog reducer hook、投影 controller hook、presentation component、純粋 normalization module に分割。
- 2026-08-23 JST — loading/empty と投影タブ close/reopen の component regression を追加。unit 195件、component 37件、axe、E2E 9件、`pnpm check`、security が合格。
- 2026-08-23 JST — synthetic E2E fixture で 1280x720 screenshot `test-results/scripture-search-refactor-164.png` を確認し、DOM/CSS の視覚的退行なし。
- 2026-08-23 JST — PR #177 の Quality、Database、E2E、Security がすべて合格。

## Decisions

- 2026-08-23 — catalog/selection は reducer を所有する hook、投影タブは専用 hook、DOM は presentation component とする。
  - Reason: request sequence と popup reference を各 lifecycle の所有者に閉じ込め、親 component を composition と validation に限定できる。
  - Alternatives: 単なる関数抽出では effect dependency と mutable lifecycle の責務が残るため採用しない。

## Risks and mitigations

- Risk: 非同期 catalog response の順序逆転で選択肢が戻る。
  - Mitigation: 現行の monotonically increasing sequence を catalog hook 内に保持する。
- Risk: 別 window からの READY を受理する。
  - Mitigation: origin/source/schema 検証を controller hook 内に維持し component test で確認する。

## Verification

- [x] `pnpm test:component` — 37 passed
- [x] `pnpm check` — pass
- [x] `pnpm test:e2e` — 9 passed
- [x] axe component/E2E assertion — violations 0
- [x] synthetic local screenshot — 1280x720 を目視確認
- [x] `pnpm security:check` — pass
- [x] `git diff --check` — pass
- [x] final diff review — scope、secret、migration、unsafe default の混入なし

## Handoff or blockers

- Completed: 実装、ローカル回帰テスト、E2E screenshot、final diff review、required CI。
- Remaining: merge。
- Blocker: なし。
- Resume with: catalog/selection hook を追加する。

## Result

受け入れ条件と必須検証を満たし、merge 待ち。
