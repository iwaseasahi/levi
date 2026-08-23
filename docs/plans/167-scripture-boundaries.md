# Scripture domain・controller・row mappingの重複整理

## Issue

- Issue: #167
- Parent: #158
- Branch: `codex/issue-167`
- Base commit: `0877cf0`

## Outcome

catalog/search/navigationの共通識別子、query multiplicity、認可response、raw row整合性変換に一つのsource of truthを置き、route固有契約とSQLを維持する。

## Context

- `search.ts` と `navigation.ts` がbook code、smallint、language、query key個数を重複定義する。
- scripture controller 3本がno-store JSONとchurch access responseを重複する。
- search/navigation repositoryがnullable raw rowのvalidationとdomain row mappingを重複する。
- 現行integration testはsearch/navigation結果と代表query planを固定する。
- Next.js 16.3.1 packageの`dist/docs`は現在のinstall artifactに含まれていないため、既存Route Handler adapterと標準`Response.json`契約を基準にする。

## Constraints

- API URL/status/error code、SQL、translation rights gate、検索/navigation挙動を変更しない。
- DB schema、API redesign、rights仕様は対象外。
- SQL CTEはquery planと可読性の改善が証明できないため統合しない。

## Plan

1. [x] book/language/translation/smallint/query multiplicityをdomain共通moduleへ抽出しcharacterization testを追加する。
2. [x] no-store JSONとchurch API access responseをcontroller helperへ抽出し、route固有error mappingを残す。
3. [x] search/navigationのraw content row validation・mappingをdatabase共通moduleへ抽出しunit/integrationで固定する。
4. [x] existing query plan、unit/controller/integration/E2E、canonical checks、required CIを確認する。

## Decisions

- 2026-08-23 — SQL CTE自体は共通化しない。
  - Reason: searchはchapter translation context、navigationはcanonical tuple探索を担い、共通fragment化はqueryの読みやすさやplanを改善しない。
- 2026-08-23 — route固有domain error mappingは各controllerに残す。
  - Reason: 409/404/500の意味がrouteごとに異なる契約である。

## Progress

- 2026-08-23 JST — identifiers/query multiplicity、controller support、raw row mapperを抽出。unit 213件が合格。
- 2026-08-23 JST — integration 73件が合格し、bounded range/navigationの代表`EXPLAIN`が既存location/navigation index利用条件を維持。
- 2026-08-23 JST — `pnpm check`、coverage、DB check、E2E 9件、securityが合格。route一覧とDB schema差分なし。
- 2026-08-23 JST — PR #180のrequired CI（Quality、Database、E2E、Security）がcommit `9a1a670`で合格。

## Risks and mitigations

- Risk: optional catalog queryとrequired search/navigation queryの個数検証が緩む。
  - Mitigation: required/optional key multiplicityを共通関数で明示し、重複・未知・欠落ケースをunit testで固定する。
- Risk: nullable outer-join rowの除外条件が変わる。
  - Mitigation: repositoryごとのinclude predicateを維持し、validation/mappingだけを共通化する。
- Risk: controller抽出でstatus/error codeが変わる。
  - Mitigation:既存controller testを変更せず全件通す。

## Verification

- [x] `pnpm test:unit`（213件）
- [x] `pnpm test:integration`（73件）
- [x] representative `EXPLAIN`（location/navigation index）
- [x] `pnpm check`（unit 213件、component 39件、build含む）
- [x] `pnpm test:unit:coverage`（statement 92.58%、branch 84.77%）
- [x] `pnpm db:check`（schema差分なし）
- [x] `pnpm test:e2e`（Chromium 9件）
- [x] `pnpm security:check`（既知の脆弱性0、license 314件承認）
- [x] `git diff --check`
- [x] required CI（Quality、Database、E2E、Security）

## Handoff or blockers

- Completed: 実装、local verification、required CI。
- Remaining: merge。
- Blocker: なし。
- Resume with: PRをmergeする。

## Result

共通domain schema、controller support、raw row mapperへ責務を集約し、API・SQL・rights・DB契約を維持した。
