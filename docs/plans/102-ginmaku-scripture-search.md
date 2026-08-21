# 聖書検索画面をGinmakuへ合わせる

## Issue

- Issue: #102
- Branch: `codex/issue-102`
- Base commit: `0c8820ca961024f7cbdc0715bc4e9c6d7ddb5f35`

## Outcome

66書巻の日英radio grid、inline範囲入力、言語radioを備えたGinmaku準拠の検索フォームから、終了節を省略して開始節から章末まで検索・投影・保存できる。

## Context

- Legacy evidence: Ginmaku `4b18adb` の `books/index.html.erb`、`book_search_form.rb`、`books.css.scss`。
- Current UI: `src/app/church/scripture-search.tsx` と `src/app/styles.css`。
- Current domain contract: `src/domain/scripture/search.ts` は正規化済みinclusive rangeを要求する。
- Approved replacement specはone-book/one-chapter rangeとresult/bookmark/controller flowを維持する。

## Constraints

- chapter/startは必須。終了省略だけを開始節から章末の連続範囲へ正規化する。
- 認証、tenant、通常Chrome投影、bookmark、accessibility状態を維持する。
- test DB port 55433だけをintegration/E2Eに使う。

## Non-goals

- 複数章検索、歌、slide、legacy projector window

## Plan

1. [x] Catalogへ日英書巻名を追加し、Ginmaku radio grid UIとinline入力へ置換する。
2. [x] 終了節省略をcatalogの最後の連続節へ正規化し、reset/result/bookmark/projectionを維持する。
3. [x] product spec、parity、component/domain/integration/E2Eを更新する。
4. [ ] 全local check、exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-22 00:47 JST — Issue #102、legacy source、current UI/domain/repository、approved product specを確認した。
- 2026-08-22 00:58 JST — 66書巻radio、3列×22行CSS、inline number input、language radio、optional end正規化、Reset、日英catalog名を実装した。component 28件、integration 72件、latest Chromium E2E 9件が成功した。
- 2026-08-22 01:00 JST — unit 142件、component 28件、integration 72件、latest Chromium E2E 9件、production build、security checkを完了した。開発DBの66巻・62,325節は不変。

## Decisions

- 2026-08-22 — Decision: API/domainの保存形式はrequired inclusive endを維持し、UIがcatalogから省略endを正規化する。
  - Reason: projection/bookmark contractを互換に保ちつつlegacyのobservable end omissionを実現できる。
  - Alternatives: nullable endをDB/API全層へ伝播すると同じ意味を複数層で解決する必要がある。
- 2026-08-22 — Decision: Ginmakuの検索formをbinding referenceとし、除外済みmenu/projector topologyは復元しない。
  - Reason: Issue #102の明示scopeと承認済みreplacement specを両立する。

## Risks and mitigations

- Risk: text inputが不存在・逆転範囲を送る。
  - Mitigation: catalog候補に照合し、domain/API validationも維持してcomponent testする。
- Risk: radio gridがcanonical order/3列配置を崩す。
  - Mitigation: 66件のCSS column-flowとlatest Chromium computed layoutをE2Eで検証する。

## Verification

- [x] `pnpm test:unit`（142 passed）
- [x] `pnpm test:component`（28 passed）
- [x] explicit port 55433 `pnpm test:integration`（72 passed）
- [x] `pnpm test:e2e`（latest Chromium、9 passed）
- [x] `pnpm check`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake、legacy evidence、design、worktree、lease、implementation、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: commit、push、PR作成。

## Result

実装完了時に更新する。
