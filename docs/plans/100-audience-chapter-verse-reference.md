# 投影画面右上を章・節表記にする

## Issue

- Issue: #100
- Branch: `codex/issue-100`
- Base commit: `32f2ee2a2300882703ffdc222fe0ae687a82d15f`

## Outcome

会衆向け投影画面の右上に、現在表示中の聖書箇所を `訳名 書巻名 : 章:節` と表示し、前後移動と章・書巻境界越えでも同期する。

## Context

- `src/app/church/projection/projection-controller.tsx` の `audienceHeading` は現在位置と同じ `ScriptureSearchItem` から書巻名と章だけを組み立てている。
- Ginmaku commit `4b18adb02ac8011630c76137c60038e168f05534` の `app/views/books/search.html.erb` は右上に訳名・日英書巻名・章、本文行頭に節を表示する。
- 利用者の承認済み改善仕様として、Ginmakuの配置と視覚仕様を維持しながら右上へ節も追加する。

## Constraints

- 投影通信protocol、デザイン、本文行頭の節番号、上下キー操作を変更しない。
- `currentItem` 以外に重複した現在位置stateを追加しない。
- E2Eとintegrationは明示したtest DB port 55433だけを使用する。

## Non-goals

- 投影画面の再デザイン
- ナビゲーション境界仕様の変更
- 操作画面の表示変更

## Plan

1. [x] `audienceHeading` を現在itemの章・節表記へ変更する。
2. [x] component testとlatest Chromium E2Eを検索・節移動・章境界・書巻境界の期待値へ更新する。
3. [x] parity/testing文書を更新し、全local checkを実行する。
4. [ ] exact-head CI成功後にPRをmergeし、Issue closeを確認する。

## Progress

- 2026-08-22 00:35 JST — Issue #100を作成し、governance、Next.js client component資料、現行実装、固定済みGinmaku sourceを確認した。
- 2026-08-22 00:38 JST — 章・節heading、日英/単言語component回帰、節・章・書巻移動E2E、parity/testing文書を更新した。latest Chromium E2E 9件が成功した。
- 2026-08-22 00:40 JST — unit 142件、component 25件、integration 72件、production build、security checkを隔離DBで完了した。開発DBの66巻・62,325節は不変。

## Decisions

- 2026-08-22 — Decision: protocol schemaを変更せず、controllerで既存heading文字列へ `item.location.verse` を追加する。
  - Reason: headingと本文は同じcurrent itemから一度に生成され、追加stateや通信契約変更なしで常に同期できる。
  - Alternatives: audience payloadへchapterを新設すると不要なprotocol version更新と同期面の増加になる。

## Risks and mitigations

- Risk: 移動後に古い章・節が残る。
  - Mitigation: 節移動・章境界・書巻境界をlatest Chromium E2Eで検証する。
- Risk: 見た目や本文行頭の節表示が変わる。
  - Mitigation: CSS/markupを変更せず、既存styleと本文行頭のassertionを維持する。

## Verification

- [x] `pnpm test:unit`（142 passed）
- [x] `pnpm test:component`（25 passed）
- [x] `pnpm test:e2e`（latest Chromium、9 passed）
- [x] `pnpm check`
- [x] explicit test DB port 55433で`pnpm test:integration`（72 passed）
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake、legacy確認、設計、worktree、lease、実装、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: commitをpushしてPRを作成する。

## Result

実装完了時に更新する。
