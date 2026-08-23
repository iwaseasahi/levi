# Issue #163: typed API client と並べ替え utility を共通化する

## Issue

- GitHub Issue: #163
- Branch: `codex/issue-163`
- Base SHA: `17d63d255c505304eaaf1c1d6323a85640fb7230`

## Outcome

検索・投影・saved content UI が同じ JSON response/error と並べ替え primitive を使い、後続 component 分割の境界が安定する。

## Context

3 component に `payload<T>`、2 component に `moveTo` が重複し、聖書検索型も domain と component に重複する。投映画面にも同種の response parsing がある。

## Constraints

- API URL、status/error code、loading/error 文言を変更しない。
- fetch injection を維持する。
- production dependency を追加しない。

## Non-goals

- JSX component 分割
- API schema / endpoint redesign
- 表示や操作仕様の変更

## Plan

1. typed JSON response/error parser と request helper を client-safe module に追加する。
2. saved-content / folder / scripture / audience の response parsing を共通 helper へ移す。
3. `ScriptureSearch` を domain の single source of truth にする。
4. reorder 純粋関数を domain utility として共通化し、単体テストする。
5. fetch injection と request sequence/cancellation 方針を testing 文書に記録する。
6. unit / component / E2E / 必須 CI を通してマージする。

## Progress

- 2026-08-23: Issue、branch、worktree、writer lease を準備。
- 2026-08-23: `payload<T>` 3箇所、`moveTo` 2箇所、`ScriptureSearch` 相当型2箇所の重複を確認。
- 2026-08-23: typed JSON client、API error、reorder utility を追加し、対象 component を共通 primitive へ移行。
- 2026-08-23: `ScriptureSearch` 型を domain の single source of truth に統一し、request sequence / queue / cancellation 方針を文書化。
- 2026-08-23: unit 191件、component 35件、E2E 9件、coverage、security、production build を含む検証を完了。

## Decisions

- HTTP error は status と server error code を保持する typed error に変換し、既存 UI 文言は呼び出し側の fallback message で維持する。
- request cancellation は audience の直列 queue と検索 catalog の sequence guard を維持し、AbortController 導入は component 分割後に判断する。

## Risks

- unauthorized status の fail-closed 分岐を generic error handling に埋没させないよう、投影 component は status 判定後に共通 parser を使う。

## Verification

- `pnpm check`: pass
- `pnpm test:e2e`: 9 passed
- `pnpm test:unit:coverage`: statements 92.77%、branches 85.36%、functions 96.96%、lines 93.57%
- `pnpm security:check`: pass
- `git diff --check`: pass
