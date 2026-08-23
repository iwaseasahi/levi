# 投影本文を画面内へ自動フィットさせる

## Issue

- Issue: #220
- Branch: `codex/issue-220`
- Base commit: `14d19ae628ec0be7c0594a90708ae335eda208b7`

## Outcome

日本語のみ、英語のみ、日本語と英語の各投影で、本文量と Chrome の表示領域に応じた最大の文字倍率を自動選択し、スクロールなしで全本文を表示する。

## Context

- 現在の `src/app/church/audience/use-audience-fit.ts` は、直前の `--audience-fit-scale` が適用された本文寸法から次の絶対倍率を一度だけ計算している。
- このため、長い本文や viewport 変更後は再計算結果が実際の折り返し後寸法と一致せず、本文が切れる場合がある。
- `src/app/styles/audience.css` は投影画面自体のスクロールを許可している。
- ユーザー提供の Ginmaku スクリーンショットは期待する自動フィット挙動の参照であり、画像資産や本文を移植するものではない。

## Constraints

- 最新版 Chrome の通常タブを対象とする。
- 既存の Ginmaku 準拠の配色、言語順、見出し、文字サイズ操作、前後移動、空白表示を維持する。
- production 由来の本文を fixture や artifact へ追加しない。
- UI の読み込み、エラー、成功、空白状態とキーボード操作を維持する。

## Non-goals

- 検索・フォルダー画面の変更
- 投影本文や書巻名表記の変更
- 新しい依存ライブラリーの導入

## Plan

1. [x] viewport 変更後に本文が切れる現状を E2E で再現する。
2. [x] 基準倍率から段階的に実寸を測り、収まる最大倍率を選ぶ純粋ロジックと client hook を実装する。
3. [x] 投影画面のスクロールを抑止し、本文の実寸測定範囲を安定させる。
4. [x] unit・component・E2E・canonical check と実ブラウザで検証する。
5. [ ] PR を作成し、必須 CI がすべて通過した exact commit のみをマージする。

## Progress

- 2026-08-24 01:08 JST — Issue #220 を作成し、現行 hook・CSS・既存 E2E を調査した。
- 2026-08-24 01:10 JST — 640×360 への viewport 変更後に本文が収まらないことを E2E で再現した（12 passed / 1 failed、追加 assertion で失敗）。
- 2026-08-24 01:12 JST — 実寸による有限探索、resize/font-ready 再計算、投影画面の overflow 抑止を実装した。
- 2026-08-24 01:16 JST — `pnpm check`、coverage、integration 77件、E2E 13件、security、DB schema/seed検証が成功した。ブラウザではローカルアプリへ接続できることを確認し、認証を含む投影実表示は synthetic account を用いる E2E で検証した。

## Decisions

- 2026-08-24 — Decision: 初期比率だけで決めず、基準倍率 1 から実際の折り返し後寸法を段階的に測定する。
  - Reason: 文字の折り返しは倍率に対して非線形であり、直前倍率を含む一回の比率計算では再配置後の高さを保証できない。
  - Alternatives: `vw` / `vh` の固定式、一回の縦横比計算。本文量と二言語表示を保証できないため採用しない。
  - ADR: 不要。投影 UI 内の可逆な実装詳細である。

## Risks and mitigations

- Risk: リサイズ中の反復測定が頻発する。
  - Mitigation: 5% 刻み・下限付きの有限探索と animation frame 単位の再計算に限定する。
- Risk: フォント読込後の寸法変化を見逃す。
  - Mitigation: viewport resize に加え `document.fonts.ready` 後にも再計算する。
- Risk: 自動縮小で文字サイズ「大・小」が無効に見える。
  - Mitigation: 手動倍率を基準サイズへ適用し、その状態で収まらない場合のみ自動倍率を追加する。

## Verification

- [x] `mise exec -- pnpm test:unit` — 251 passed（CI相当の環境値で実行）。
- [x] `mise exec -- pnpm test:component` — 40 passed。
- [x] `mise exec -- pnpm test:e2e` — latest Chromium 13 passed。
- [x] `mise exec -- pnpm check` — format、lint、type、unit、component、config、production build が成功。
- [x] viewport を 1280×720 → 640×360 → 1280×720 と変更し、全本文がスクロールなしで表示され、拡大時に倍率が戻ることを E2E で確認した。
- [x] `mise exec -- pnpm test:integration` — 77 passed。
- [x] `mise exec -- pnpm test:unit:coverage` — statements 93.3%、branches 88.98%、functions 93.85%、lines 94.42%。
- [x] `mise exec -- pnpm security:check` — vulnerability 0、approved license 314件。
- [x] `mise exec -- pnpm db:check` — migration差分なし、seed・接続検証成功。
- [x] 最終 diff を scope、secret、migration、unsafe default の観点で確認する。

## Handoff or blockers

- Completed: 再現テスト、自動フィット実装、ローカル全検証。
- Remaining: commit、PR、required CI、merge。
- Blocker: なし。
- Resume with: viewport 変更を含む E2E を追加し、現行実装で失敗することを確認する。

## Result

本文の基準倍率を毎回 1 に戻したうえで、実際の折り返し後寸法を5%刻みで測る自動フィットへ変更した。viewport とフォント読込後に再計算し、投影面のスクロールを禁止した。ローカル品質ゲートと 1280×720 / 640×360 の Chromium 回帰検証は成功している。PR の required CI と merge 結果は完了時に追記する。
