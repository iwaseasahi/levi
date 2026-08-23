# 聖書検索操作を1画面に収める

## Issue

- Issue: #214
- Branch: `codex/issue-214`
- Base commit: `1091f7d`

## Outcome

最新版Chromeの標準的なデスクトップ表示領域で、フォルダー、66書巻、検索条件、表示言語、実行ボタン、投影操作をdocumentの縦スクロールなしで操作できる。

## Context

- `src/app/church/scripture-search-view.tsx` は66書巻を3列×22行のtableにし、検索操作をその下へ縦3段で配置している。
- `src/app/styles/ginmaku-search.css` の書巻choiceは1行30px以上、tableの行間は4pxで、Retina表示のCSS viewport約1365×683では検索操作が画面外になる。
- 左のフォルダーは `src/app/styles/folders.css`、検索・投影操作は `src/app/styles/ginmaku-search.css` が担当する。
- 添付画像は現状確認のための参考であり、画像内に実行指示はない。

## Constraints

- 3列×22行の書巻順、検索、投影、フォルダー、キーボード操作の仕様を変えない。
- 対象は最新版Chrome。狭い画面ではdocumentではなく個別領域のscrollを許容する。
- 新しいproduction依存は追加しない。
- `docs/governance/autonomy.md` と `docs/governance/agent-execution-protocol.md` に従い、required CI通過後にmergeする。

## Non-goals

- 聖書本文、DB schema、検索APIの変更。
- モバイル専用UIの新設。

## Plan

1. [x] 書巻table、検索操作バー、投影操作をviewport高を配分するgridへ再構成する。
2. [x] 書巻行と操作バーを高密度化し、フォルダー領域だけ必要時に内部scroll可能にする。
3. [x] component/E2Eを更新し、1365×683と1280×720でdocument縦scrollなし・66書巻と主要操作の表示を固定する。
4. [x] 実ブラウザで視覚確認し、canonical checksとrequired CIを完了する。

## Progress

- 2026-08-24 00:28 JST — Issue #214、現行DOM/CSS、関連component/E2E、Next.js CSS資料を確認した。
- 2026-08-24 00:36 JST — 3列×22行へ残余高を均等配分し、Ginmakuと同じ検索条件→言語→actionの縦3段配置をcompact化した。component 40件、latest Chromium E2E 13件が成功した。
- 2026-08-24 00:40 JST — 1365×683のviewport配置とGinmaku由来の縦3段順序をE2Eで固定した。`pnpm check`（unit 251件、component 40件、buildを含む）とlatest Chromium E2E 13件が成功した。
- 2026-08-24 00:42 JST — PR #215のQuality、Database、E2E、Securityがcommit `71622ba` で全て成功した。

## Decisions

- 2026-08-24 — Decision: 3列×22行と、検索条件→言語→actionのGinmaku由来の縦3段配置を維持し、書巻一覧へ残余高を均等配分する。
  - Reason: 書巻と下部操作の認知位置を変えずに、過大な行高・余白だけを解消できる。
  - Alternatives: 横一列への集約、書巻select化、タブ分割は既存利用者の配置記憶と操作手順を変えるため採用しない。

## Risks and mitigations

- Risk: 低いviewportで書巻labelが小さくなりすぎる。
  - Mitigation: 最小の文字・クリック領域を保ち、さらに低い場合だけ書巻領域を内部scrollに切り替える。
- Risk: table再構成で書巻順やaccessible nameが変わる。
  - Mitigation: 66件、先頭行の1/23/45番、axe、実検索をcomponent/E2Eで検証する。

## Verification

- [x] `mise exec -- pnpm test:component -- src/app/church/scripture-search.component.test.tsx` — 40件成功
- [x] `mise exec -- pnpm test:e2e -- tests/e2e/scripture-search-validation.spec.ts` — latest Chromium 13件成功
- [x] `mise exec -- pnpm check` — format、lint、typecheck、unit 251件、component 40件、config checks、build成功
- [x] 1365×683でdocument縦scrollなし、書巻・Open・章・投影操作・フォルダーがviewport内
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: layout、compact CSS、component/E2E回帰。
- Remaining: merge。
- Blocker: なし。
- Resume with: `pnpm check`。

## Result

66書巻へviewportの残余高を配分し、Ginmakuと同じ下部3段操作と右側投影操作を維持したまま、1365×683でdocument縦scrollをなくした。小さい高さでは検索操作を固定して書巻領域だけを内部scrollする。component 40件、latest Chromium E2E 13件、`pnpm check`、PR #215のrequired CI 4件が成功した。
