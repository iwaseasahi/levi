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
- 大規模検索の計測と最適化判断は既存Issue #397が所有する。

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
4. [ ] #446のcomponent/E2Eとrequired CIを通し、mergeする。
5. [ ] 親Issue #444へ最終mainの検証証跡を記録して閉じる。

## Progress

- 2026-09-01 14:15 JST — 全体とSlide境界を監査し、#444〜#446へ分割した。
- 2026-09-01 14:24 JST — #445の単一surface state化を完了し、unit 19件、component 6件、`pnpm check`を通した。
- 2026-09-01 14:30 JST — #445をrequired CI成功後にPR #447でmergeした。
- 2026-09-01 14:32 JST — #446のfavorite mutationを共通hookへ統合し、二重送信とunmount後完了をcomponent testへ追加した。

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
- [ ] 各PRのQuality / Database / E2E / Securityがexact headで成功

## Handoff or blockers

- Completed: 監査、scope分割、#445開始。
- Remaining: #445、#446の実装・検証・merge、親Issue完了記録。
- Blocker: なし。
- Resume with: `src/application/slides/project-slide.ts`のstateを単一本文へ変更する。

## Result

進行中。
