# Openから聖書投映画面を直接開く

## Issue

- Issue: #106
- Branch: `codex/issue-106`
- Base commit: `2826e34621403c4bf57cae5bea1b3450f0c6cb57`

## Outcome

検索画面のOpenとブックマークは検索tabを残し、Ginmaku表示の聖書本文をnamed ordinary tab `projector`へ直接開く。投影操作画面を経由しない。

## Context

- Binding legacy evidence: Ginmaku `4b18adb02ac8011630c76137c60038e168f05534` の `books/index.html.erb`、`books/search.html.erb`、`books.js.coffee`。
- 現在はOpenが同一tabの`/church/projection`へ遷移し、そこからaudience tabを開く。
- 既存のaudience CSS、search/navigation API、30秒session verificationを再利用する。

## Constraints

- URLへ聖書本文、tenant ID、DB IDを含めない。
- 検索終了節、章、書巻境界を越える上下key navigationを維持する。
- 認証失効・API拒否時は本文をfail closedで除去する。
- production dataをtest/artifactへ含めない。

## Non-goals

- 既存projection controller routeの削除。
- font/scroll/blank用の新しい検索画面control。
- database/schema変更。

## Plan

1. [x] audience routeへvalidated search paramsとstandalone direct displayを追加する。
2. [x] search Open/bookmarkをsynchronous named-tab openへ変更する。
3. [x] component/E2E/product/parity docsをdirect flowへ更新する。
4. [ ] canonical local checks、exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-22 10:02 JST — Issue #106、parent #38、Ginmaku fixed source、current search/controller/audience implementationを確認した。
- 2026-08-22 10:10 JST — Direct audience、named-tab Open、bookmark reuse、Ginmaku display、serial boundary navigation、fail-closed session verificationを実装した。
- 2026-08-22 10:10 JST — Component 31、unit 142、integration 72、latest-Chromium E2E 9、build、database、security checksがlocalで成功した。

## Decisions

- 2026-08-22 — Decision: `/church/audience`へcanonical coordinatesを渡し、audience自身がsearch/navigation APIを読む。
  - Reason: search tabを残し、controllerを経由せず、本文をURLへ含めずに直接表示できる。
  - Alternatives: blank tabを先に開いてasync validation後にlocation設定する方式は二重fetchと中間blank stateを生む。
- 2026-08-22 — Decision: Ginmakuの`target=projector`に合わせnamed tab `projector`を再利用する。
  - Reason: Openごとに不要な投影tabを増やさず、browser gesture内で同期的に開ける。

## Risks and mitigations

- Risk: popup blockerがOpenを拒否する。
  - Mitigation: submit/click handler内でawait前に`window.open`し、拒否時はsearch画面にaccessible errorを表示する。
- Risk: controllerを外すとkeyboard navigation/session fail-closedが失われる。
  - Mitigation: standalone componentのserial queue、visibility/interval check、component/E2E boundary casesで固定する。

## Verification

- [x] `pnpm test:unit` — 142 passed
- [x] `pnpm test:component` — 31 passed
- [x] explicit port 55433 `pnpm test:integration` — 72 passed
- [x] explicit port 55433 `pnpm test:e2e` — 9 passed
- [x] `pnpm check`
- [x] `pnpm db:check`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI

## Handoff or blockers

- Completed: intake、worktree、lease、legacy/current design investigation、implementation、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: commit、push、PR、required CI監視。

## Result

検索画面とbookmarkから投影操作画面を経由せず、named ordinary tab `projector`の`/church/audience`へcanonical coordinatesを渡して本文を直接表示する。AudienceはGinmaku displayを維持し、上下keyで終了節、章、書巻境界を越えて移動し、session拒否時は本文をfail closedで除去する。
