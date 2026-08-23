# 聖書検索画面の操作部品をモダンにする

## Issue

- Issue: #144
- Branch: `codex/issue-144`
- Base commit: `572819b7d982ffc8791589e2487feb9f48d2c773`

## Outcome

聖書検索画面の既存フローと横長の配置を維持しながら、書巻選択、検索条件、表示言語、投影操作、主要ボタンをLeviの黒基調に合うモダンで判別しやすいUIへ更新する。

## Context

- `/scripture` はGinmaku由来の3列・22行の書巻配置と左側のフォルダーを提供している。
- フォルダー領域は既にモダン化されている一方、検索領域はブラウザ標準の入力欄とボタンが混在している。
- 検索、別タブ投影、文字サイズ、前後移動、空白表示の挙動とaccessible nameは既存テストで固定されている。

## Constraints

- 書巻の3列・22行、フォルダーの左配置、Open/Reset/空白表示、投影操作の挙動を変更しない。
- 投映画面、API、DB、認証、依存関係を変更しない。
- 最新版Chromeを対象とし、狭い画面では横スクロールで全操作へ到達できるようにする。
- hover、focus-visible、selected、disabled、error/loadingを色だけに依存せず判別可能にする。

## Non-goals

- 検索フローや入力項目の追加
- 投映画面やフォルダー管理画面の再設計
- mobile専用の書巻配置

## Plan

1. [x] 書巻、検索条件、表示言語、投影操作、action群へ意味のあるUI構造とclassを追加する。
2. [x] 黒基調のsurface、選択状態、操作階層、focus/disabled状態を実装する。
3. [x] product contract、component/E2Eを更新し、通常幅と狭幅を検証する。
4. [ ] canonical checks、PR exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-23 — Issue #144を作成し、現行のUI、画面契約、component/E2Eを確認してwriter leaseを取得した。
- 2026-08-23 — 書巻と表示言語の選択状態、range toolbar、投影操作panel、primary/secondary/blank actionを実装した。component 35件とlatest Chromium E2E 9件が成功した。
- 2026-08-23 — 実ブラウザで通常幅と800px幅を確認した。800px幅では1170pxの横スクロール領域を維持し、既存の横長配置を崩さず全操作へ到達できる。
- 2026-08-23 — format、lint、typecheck、unit 166件、component 35件、production build、integration 74件、security audit/license checkを完了した。
- 2026-08-23 — PR #145のimplementation head `d552df7` でQuality、Database、E2E、Securityがすべて成功した。

## Decisions

- 2026-08-23 — Decision: 3列・22行のtable構造を維持し、各選択肢と下部toolbarを段階的にmodernizeする。
  - Reason: 操作位置の学習を壊さず、視認性と状態表現だけを改善できる。
- 2026-08-23 — Decision: Openをgoldのprimary action、Resetをdark secondary、空白切替をoutlined actionとして区別する。
  - Reason: 投影開始、入力取消、投影中操作の意味が異なるため、視覚的な優先度を一致させる。

## Risks and mitigations

- Risk: 66書巻の装飾で画面密度が下がる。
  - Mitigation: 既存の3列配置を保ち、各行の高さと余白をcompactに固定する。
- Risk: disabled状態の文字contrastが不足する。
  - Mitigation: opacityだけでなくborder/background/cursorも使い、Axeと実画面で確認する。

## Verification

- [x] `pnpm test:component` — 35 passed
- [x] `pnpm test:e2e` — latest Chromium 9 passed
- [x] `pnpm check` — format、lint、typecheck、166 unit、35 component、build passed
- [x] `pnpm test:integration` — 74 passed
- [x] `pnpm security:check` — no known vulnerability; 314 approved licenses
- [x] `git diff --check`
- [x] exact-head required CI — Quality、Database、E2E、Security passed on `d552df7`
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake、Issue、worktree、lease、実装、全local verification、実画面確認、PR、exact-head CI。
- Remaining: merge。
- Blocker: none。
- Resume with: completion record commitのexact-head CIを確認してPR #145をmergeする。

## Result

PR #145は、検索や投影の挙動を変えず、書巻・言語の選択状態、range
toolbar、投影操作panel、Open/Reset/空白切替を黒基調のmodern UIへ統一した。
通常幅と800px幅で操作可能性を確認し、component、latest Chromium E2E、
integration、build、security verificationが成功した。
