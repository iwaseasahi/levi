# Audience 制御・session監視・text fittingを分離する

## Issue

- Issue: #166
- Branch: `codex/issue-166`
- Base commit: `de01bc0`

## Outcome

投映画面のsession fail-close、navigation queue、opener message、文字fit、表示を独立して検証できる境界へ分割する。

## Context

- `direct-audience-display.tsx` 304行がinitial search、30秒session監視、直列navigation、postMessage、keyboard、layout測定、DOMを所有する。
- component 4件とE2Eが日本語/英語順、章・書巻境界、queue、trust boundary、fail-closeを固定する。
- Next.js 16.3.1同梱の`use client`文書は#164で確認済み。

## Constraints

- ArrowUp/Down、章・書巻境界、30秒session確認、空白、文字サイズ、見出し/本文形式を変更しない。
- unauthorized時はprotected textを即時除去する。
- opener origin/source/schema検証を維持する。

## Non-goals

- 投影デザイン変更、WebSocket、API/route変更。

## Plan

1. [x] initial search/session monitor/navigation queueをaudience data controller hookへ分離する。
2. [x] opener message/READY/keyboard/表示controlをmessage controller hookへ分離する。
3. [x] text fit計算を純粋関数とlayout hookへ分離し、layout read/write回数を制限する。
4. [x] audience viewをpresentation componentへ分離する。
5. [ ] unit/component/E2E/Chrome screenshot、`pnpm check`、security、required CIを通す。

## Progress

- 2026-08-23 JST — Issue、現行304行component、component/E2E責任範囲を確認。
- 2026-08-23 JST — fit scaleを純粋関数化し、寸法read後にCSS writeを一度だけ行うlayout hookへ移行。unit 198件、component 38件、typecheck、lintが合格。
- 2026-08-23 JST — data、session monitor、navigation queue、opener/keyboard control、presentationを独立moduleへ分離。分離直後のtypecheck、lint、component 38件が合格。
- 2026-08-23 JST — navigation応答とsession失効の競合回帰を追加。unit 198件、component 39件、integration 73件、E2E 9件、`pnpm check`、security、DB検証、Chrome screenshotが合格。

## Decisions

- 2026-08-23 — protected scripture stateとauthorization refは同じdata controllerが所有する。
  - Reason: fail-close時のref/state同時消去を一つのatomicな責務に保つ。
- 2026-08-23 — fitは寸法を一度読み、比率からscaleを算出してCSS writeを一度にする。
  - Reason: 現行while loopのread/write反復によるlayout thrashingを除去できる。

## Risks and mitigations

- Risk: navigation queue分割時にrapid key入力の順序を失う。
  - Mitigation: promise queueをdata controller内に保持し既存component testを通す。
- Risk: fail-close後にqueued navigationが本文を再表示する。
  - Mitigation: authorized refを各queue実行前とresponse commit前に検証する。

## Verification

- [x] pure fit unit tests（3件）
- [x] `pnpm test:component`（39件）
- [x] `pnpm test:e2e`（9件）
- [x] Chrome screenshot
- [x] `pnpm check`（unit 198件、component 39件、build含む）
- [x] `pnpm security:check`（脆弱性0、license 314件承認）
- [x] `pnpm db:check` / `pnpm test:integration`（73件）
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: 実装、回帰テスト、local canonical checks、E2E、Chrome screenshot。
- Remaining: PR更新、required CI、merge。
- Blocker: なし。
- Resume with: PR headをpushしrequired CIを確認する。

## Result

未完了。
