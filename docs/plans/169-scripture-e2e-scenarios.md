# Scripture E2Eを診断可能なシナリオへ分割する

## Issue

- Issue: #169
- Parent: #158
- Branch: `codex/issue-169`
- Base commit: `89659eb`

## Outcome

単一600行のscripture E2Eを、失敗した利用契約がtest名とartifactから判別できる独立scenarioへ分割する。各scenarioは固有の教会accountとbrowser contextを所有する。

## Context

- `tests/e2e/scripture-search.spec.ts`は検索UI、validation、言語、投影、navigation、window recovery、folder/bookmark、tenant negativeを1 testで検証している。
- Playwrightは`fullyParallel: true`、retry 0、失敗時trace/screenshot/video保持で実行する。
- 現行global fixtureの聖書catalogは全testからread-onlyで参照できるが、church userとsaved contentはscenario間で共有できない。

## Constraints

- 製品コード、observable assertion、latest Chrome、retry 0を変更しない。
- console/page error guardをdefault pageだけでなくpopup投影画面にも維持する。
- production data、実dump、secretをfixture/artifactへ含めない。

## Non-goals

- assertion削減だけによる高速化、E2E retry、製品仕様変更。
- shared scripture catalogのtestごとの複製。

## Plan

1. [x] 分割前のsuite構造とfixture境界を調査し、実行時間baselineを取得する。
2. [x] scenario固有church account fixtureとlogin/catalog/projector helperを追加する。
3. [x] search validation、projection/navigation、window recovery、folder/bookmark、tenant negativeへ分割する。
4. [x] scenario単体とfull E2Eを複数回実行し、artifact、時間、flake、canonical checksを確認する。required CIはPRで確認する。

## Progress

- 2026-08-23 16:05 JST — Started; Issue #169/#158、`docs/testing.md`、Playwright config、現行600行specを確認。
- 2026-08-23 16:07 JST — Baseline full E2E 9件成功、Playwright 15.9秒、command wall time 24.70秒。
- 2026-08-23 16:12 JST — 5 scenarioを初回並列実行し、共有IP rate limitとの競合をfailure trace/screenshot/videoから特定。
- 2026-08-23 16:14 JST — test固有sessionと署名済みcookieへ切替。13件成功、Playwright 8.3秒、wall time 11.01秒。
- 2026-08-23 16:19 JST — retry 0でfull E2Eを連続成功（11.01秒、10.96秒、11.08秒、最終12.12秒）。canonical checks完了。

## Decisions

- 2026-08-23 — 聖書catalogはglobal setupのread-only fixtureを維持し、church accountとsaved contentだけをtest fixtureで分離する。
  - Reason: catalogを並行testが変更せず、tenant-scoped mutationだけが現在の競合源であるため。
  - Alternatives: 各testでcatalogを全再作成するとfully parallel実行時にcanonical codeが競合する。
- 2026-08-23 — Scripture scenarioはUI sign-inを繰り返さず、fixtureがDB sessionとBetter Auth互換の署名済みcookieを作成する。
  - Reason: UI loginは既存auth E2Eの責務であり、追加5 loginはIP単位のproduction-equivalent rate limitを消費して無関係なscenarioと競合した。
  - Alternatives: rate limitを無効化・緩和・test間で削除する案はproduction設定または共有DB stateを変更するため不採用。

## Risks and mitigations

- Risk: scenario分割後に同一churchのfolder mutationが競合する。
  - Mitigation: testごとにUUID付きchurch/user/accountを作成し、teardownで削除する。
- Risk: popup内のbrowser errorがguard対象外になる。
  - Mitigation: contextから生成される全pageへ同じerror observerを登録する。
- Risk: helper抽象化でassertionの意味が隠れる。
  - Mitigation: helperはlogin、検索条件入力、popup openまでに限定し、契約assertionはscenarioへ残す。

## Verification

- [x] 分割前後の実行時間とtest件数を記録（9→13件、24.70→11.01秒）
- [x] `pnpm test:e2e`を連続3回（最終変更を含め4回成功）
- [x] failure artifact設定とretry 0が不変（初回競合時にtrace/screenshot/videoを確認）
- [x] `pnpm check`（unit 213件、component 39件、production buildを含む）
- [x] `pnpm test:integration`（73件）
- [x] `pnpm security:check`（high以上0件、license 314件承認済み）
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: Issue intake、baseline、fixture/helper、5 scenario分割、popup error guard、E2E連続実行、canonical checks。
- Remaining: PR、required CI、merge。
- Blocker: なし。
- Resume with: commitを作成してDraft PRを開く。

## Result

600行の単一testを5つのobservable scenarioへ分割した。各scenarioは固有tenant/session/browser contextを持ち、共有するのはread-only synthetic scripture catalogだけになった。全browser pageのerror guardを維持し、retry 0で4回連続成功した。
