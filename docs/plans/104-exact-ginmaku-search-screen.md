# 聖書検索画面全体をGinmakuと一致させる

## Issue

- Issue: #104
- Branch: `codex/issue-104`
- Base commit: `bef2211ee92af04685c6b0dd98711567bfb9df46`

## Outcome

`/church` はGinmakuと同じtable検索formだけを主画面とし、Levi固有header/logout/result previewなしでOpenから直接投影操作へ進む。

## Context

- Binding legacy evidence: Ginmaku `4b18adb` の `books/index.html.erb` と `books.css.scss`。
- #102はcontrol/fontを合わせたが、Levi固有のpage chrome、CSS grid、result previewが残る。
- Folder/bookmark、authentication、ordinary Chrome audience tabはapproved replacement scopeとして維持する。

## Constraints

- active church/session validationを削除しない。
- legacy songs/slides/remote controls/projector popupは復元しない。
- optional endはchapter endへ正規化した具体的rangeとしてprojection/bookmarkへ渡す。

## Non-goals

- authentication/logout API削除
- folder/bookmark削除
- projection controller/audience redesign

## Plan

1. [x] page header/logoutとresult previewを削除し、Open/reopenを直接projection routeへ接続する。
2. [x] formをlegacy table row順・native controls・spacingへ置換し、bookmarkをflatなlegacy-compatible surfaceにする。
3. [x] component/latest Chromium E2Eとproduct/parity文書を更新する。
4. [ ] 全local check、exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-22 08:40 JST — Issue #104、#102実装、legacy binding source、approved retained scopeを確認した。
- 2026-08-22 09:46 JST — black/white legacy surface、3列×22行table、direct projection、header/logout/result removal、bookmark direct reopenを実装し、unit 142件、component 28件、latest-Chromium E2E 9件、production buildを検証した。
- 2026-08-22 09:47 JST — 誤って開発DBへ向いたE2Eがfixture対象2書巻を除去したため、承認済みdumpからtransaction復旧。66書巻・132名称・62,325節、full/sample fingerprint一致を確認した。以後E2Eはport 55433を明示する。

## Decisions

- 2026-08-22 — Decision: Open前に既存search API validationを行い、成功時に同じtabでprojection controllerへ遷移する。
  - Reason: result previewをなくしつつexplicit errorsとtwo-window audience topologyを維持する。
  - Alternatives: legacy projector popupはapproved Chrome topologyと衝突するため採用しない。
- 2026-08-22 — Decision: bookmark保存にはcatalogから正規化できるcurrent form rangeを渡す。
  - Reason: result preview削除後もinitial-release bookmark flowを失わない。

## Risks and mitigations

- Risk: hidden preview removalでprojection query/bookmark rangeが失われる。
  - Mitigation: pure normalization helperとcomponent/E2EでURL・save/reopenを検証する。
- Risk: header removalでauthorization checkまで消す。
  - Mitigation: server pageのaccess/church existence checkを維持しnegative E2Eを継続する。

## Verification

- [x] `pnpm test:unit` — 142 passed
- [x] `pnpm test:component` — 28 passed
- [x] explicit port 55433 `pnpm test:integration` — 72 passed
- [x] `pnpm test:e2e` — 9 passed on latest Chromium
- [x] `pnpm check` — all stages passed; production build rerun with synthetic HTTPS origins
- [x] `pnpm security:check` — no known vulnerability; 314 approved licenses
- [x] `git diff --check`
- [ ] exact-head required CI

## Handoff or blockers

- Completed: intake、design、implementation、local unit/component/E2E/build verification、local Bible data recovery/reconciliation。
- Remaining: integration/security、PR、CI、merge。
- Blocker: none。
- Resume with: explicit test DB integration/security checks, commit, PR, CI, merge。

## Result

実装完了時に更新する。
