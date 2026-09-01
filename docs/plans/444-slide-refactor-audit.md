# Slide機能の保守性課題を段階的に解消する

## Issue

- Parent Issue: #444
- Child Issues: #445, #446
- Base commit: `ec0788669413c2088865777ba7418865398977a0`

## Outcome

既存の画面、API、認可、投影結果を維持しながら、単一surface仕様後に残った
Slide page modelと、お気に入り追加処理の重複を独立したPRで解消する。

## Context

- `docs/product/slide-contract.md`は1つのSlide本文を1つのsurfaceとして投影する。
- `src/application/slides/project-slide.ts`には旧page配列、navigation queue、
  page callbackが残り、単一ページでもnavigationごとに再認可readを行う。
- `src/app/slides/slide-list.tsx`と`slide-controller.tsx`は同じfavorite
  mutationとpending/error処理を重複実装している。
- 当時の大規模検索の計測と最適化判断はIssue #397へ分離したが、後のユーザー判断で検索API自体を削除した。

## Constraints

- product behavior、URL、API response、DB schema、tenant/auth boundaryを変えない。
- Scripture navigationとprojection transport versionを変えない。
- rolling compatibilityのためSlide wire acknowledgementの固定page metadataを維持する。
- production dependency、migration、test retry、production deployを追加しない。

## Non-goals

- UI redesign、新機能、検索indexの推測追加、bookmark APIの再設計。
- 行数だけを目的としたSlide CRUD/search repositoryの再分割。

## Plan

1. [x] #445でSlide audience state/sessionを単一本文へ整理し、到達不能なnavigationを削除する。
2. [x] #445のunit/component/E2Eとrequired CIを通し、mergeする。
3. [x] #446でfavorite mutationをlifetime/concurrency guard付きhookへ統合する。
4. [x] #446のcomponent/E2Eとrequired CIを通し、mergeする。
5. [x] 親Issue #444へ最終mainの検証証跡を記録して閉じる。

## Progress

- 2026-09-01 14:15 JST — 全体とSlide境界を監査し、#444〜#446へ分割した。
- 2026-09-01 14:24 JST — #445の単一surface state化を完了し、unit 19件、component 6件、`pnpm check`を通した。
- 2026-09-01 14:30 JST — #445をrequired CI成功後にPR #447でmergeした。
- 2026-09-01 14:32 JST — #446のfavorite mutationを共通hookへ統合し、二重送信とunmount後完了をcomponent testへ追加した。
- 2026-09-01 14:38 JST — #446をrequired CI成功後にPR #448でmergeし、最終main `db21d94`を確認した。

## Decisions

- 2026-09-01 — Decision: shared transportの`ProjectionAction`は変更しない。
  - Reason: previous/next/select-pageはScripture projectionの現行機能である。
  - Alternatives: kind別transportへの全面分割は挙動とrolling compatibilityの変更面が大きい。
- 2026-09-01 — Decision: Slide wire stateの`page=0/pageCount=1`は固定値として維持する。
  - Reason: open済みcontroller/audienceを安全にfail closedまたは継続させ、protocol version変更を避ける。
  - Alternatives: wire field削除は将来の明示的なprotocol version更新で検討する。

## Risks and mitigations

- Risk: state整理で失効後に本文が残る。
  - Mitigation: revision、denial、late response、disposeのunit/component/E2Eを維持する。
- Risk: favorite共通化で一覧全体の同時送信防止やdisabled表示が変わる。
  - Mitigation:一覧と詳細の既存component testに同時送信とunmount完了を追加する。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] PR #447、#448のQuality / Database / E2E / Securityがexact headで成功

## Handoff or blockers

- Completed: 監査、scope分割、#445と#446の実装・検証・merge、最終main同期。
- Remaining: なし。
- Blocker: なし。
- Resume with: なし。検索性能scopeは後のIssue #397で削除判断へ変更された。

## Result

Slide投影の内部状態を単一本文へ整理し、旧ページ配列、navigation queue、
URL page同期を削除した。wire acknowledgementの固定page metadataとScriptureの
projection transportは維持した。

一覧と詳細に重複していたお気に入り追加を共通hookへ統合し、同期的な二重送信防止、
component lifetime固定のfetcher、unmount後のstate/callback更新防止を共通化した。
DB schema、API payload、UI、production dependency、migrationは変更していない。

最終検証はunit 436件、component 98件、integration 128件、E2E 33件、production
build、security audit、license checkが成功した。当時は検索性能の計測をIssue #397へ
残したが、その後のユーザー判断により本文検索/recent API自体を削除した。
