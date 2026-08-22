# 検索画面から投影中の御言葉を直接操作する

## Issue

- Issue: #108
- Branch: `codex/issue-108`
- Base commit: `d442e6ff76c3b731186142b66494ecca2a8e085f`

## Outcome

Ginmakuと同じ「文字 大／小」「スクロール 上／下」を検索画面へ表示し、`Open`で開いたnamed ordinary tab `projector`の御言葉を検索画面から直接操作できる。

## Context

- Binding legacy evidence: Ginmaku `4b18adb02ac8011630c76137c60038e168f05534` の `books/index.html.erb`、`common.js.coffee`、`books.js.coffee`。
- Ginmakuのスクロール操作は物理的なviewport scrollではなく、現在の御言葉を前／次へ切り替える。
- Leviのdirect audienceは`src/app/church/audience/direct-audience-display.tsx`が本文、keyboard navigation、session fail-closedを所有する。
- 検索画面は`window.open(..., "projector")`のWindow referenceを現在保持していない。

## Constraints

- 同一origin、正しいopener/target、runtime-validated messageだけを受理する。
- URLやmessageへ聖書本文、tenant ID、DB IDを含めない。
- 認証失効後のaudienceはcontrol messageを受理しない。
- 既存Open、bookmark、上下key、章・書巻境界navigationを維持する。
- schema/database変更とlegacy controller route削除は行わない。

## Non-goals

- viewportの任意位置をpixel単位でscrollするcontrol。
- blank/unblank、font値入力、複数audience tabの同時control。
- Ginmakuのbookmark accordion全体の再実装。

## Plan

1. [x] direct audience control message contractとtrust validationを追加する。
2. [x] 検索画面へGinmaku controlsとprojector lifecycle管理を追加する。
3. [x] audienceへfont scaleと前／次navigation control受信を追加する。
4. [x] unit/component/E2E/product/security docsを更新し、canonical checksを通す。
5. [ ] exact-head CI成功後にPRをmergeしIssueを閉じる。

## Progress

- 2026-08-22 10:20 JST — Issue #108、parent #106、Ginmaku fixed source、current direct audience implementationを確認した。
- 2026-08-22 10:28 JST — Strict direct-control protocol、READY lifecycle、Ginmaku fourth-column controls、font scaling、serial previous/next navigationを実装した。
- 2026-08-22 10:28 JST — Unit 145、component 34、integration 72、latest-Chromium E2E 9、build、database、security checksがlocalで成功した。

## Decisions

- 2026-08-22 — Decision: Ginmakuの`scroll_up/down`と同じく、検索画面のスクロール操作は前／次の御言葉へ移動する。
  - Reason: Binding sourceの`books.js.coffee`はcurrent verse indexを増減し、viewportをscrollしていない。
  - Alternatives: DOM `scrollBy`は既存legacy controller固有の挙動であり、今回提示されたGinmaku仕様と異なる。
- 2026-08-22 — Decision: direct flow専用のversioned `postMessage` contractを使用する。
  - Reason: cross-window direct function invocationよりpayloadとsource/originを厳格に検証でき、legacy controller protocolを変更せずに済む。

## Risks and mitigations

- Risk: audience load前、閉鎖後、cross-origin navigation後にcontrolが送信される。
  - Mitigation: exact Window referenceからのREADY後のみ有効化し、closed detectionとtarget-origin指定を行う。
- Risk: font拡大で本文が画面外へ溢れる。
  - Mitigation:既存shrink-to-fitをfont scale変更時にも再計算し、component/E2Eで確認する。

## Verification

- [x] `pnpm test:unit` — 145 passed
- [x] `pnpm test:component` — 34 passed
- [x] explicit port 55433 `pnpm test:integration` — 72 passed
- [x] explicit port 55433 `pnpm test:e2e` — 9 passed
- [x] `pnpm check`
- [x] `pnpm db:check`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI

## Handoff or blockers

- Completed: intake、worktree、lease、legacy/current investigation、implementation、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: final diff review、commit、push、PR、required CI監視。

## Result

検索画面の第四columnへGinmaku controlsを追加した。Openした正しいaudienceが本文を読み込みREADYを返した後だけcontrolを有効化する。Fontは60–220%で調整し、スクロール上／下はGinmakuどおりserial canonical previous/next navigationを行う。Strict same-origin/exact-window protocolとsession fail-closedで保護する。
