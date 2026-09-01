# 不要になったSlide検索APIを削除する

## Issue

- Issue: #397
- Parent history: #385 / #59
- Product decision: 2026-09-01、本文検索とrecent APIは不要
- Base commit: `d494032f31207c0838edca97b0350d295c905fb9`

## Outcome

`GET /api/church/slides`をtenant-scopedな全件一覧とcursor paginationだけに縮小し、
UIから既に撤去済みの本文検索・recent機能とその保守コストを削除する。

## Constraints

- Church scope、作成日時順、20件keyset pagination、認可、no-storeを維持する。
- `q`、`mode`、未知・重複parameterは黙って無視せず400で拒否する。
- DB schema、migration、production dependency、production環境を変更しない。
- synthetic fixtureだけを使い、required CIをexact headで確認する。

## Plan

1. [x] search domain/application/repository/APIを単純なlist境界へ置き換える。
2. [x] Slide一覧clientをparameterなしの初回requestへ変更する。
3. [x] unit/component/integration/E2Eをlist契約へ更新し、旧query拒否を確認する。
4. [x] active product/testing/migration文書と不要な性能計測scriptを整理する。
5. [x] full local verificationとrequired CIを通してmergeし、Issue #397を閉じる。

## Progress

- 2026-09-01 14:47 JST — #397、親#385/#59、#412と現行実装を照合し、ユーザー判断に合わせてIssue scopeを更新した。
- 2026-09-01 14:53 JST — list境界への置換、旧query拒否、性能計測script削除、active contract更新を完了。focused unit 20件、component 5件、integration 6件とtypecheckが成功した。
- 2026-09-01 14:55 JST — 初回E2Eで旧`?*` route interceptionがqueryなし一覧を捕捉しないことを検出。exact collection URLへ更新後、33件すべて成功した。
- 2026-09-01 15:00 JST — PR #450のQuality / Database / E2E / Securityがexact headで成功した。

## Decisions

- `GET /api/church/slides`自体は一覧画面が使用するため維持し、本文検索/recentだけを削除する。
- cursorからquery bindingを削除する。filterが存在しなくなるため、createdAt/idだけで十分である。
- 旧queryを無視すると古いclientが意図と違う全件一覧を受け取るため400で拒否する。

## Risks and mitigations

- Risk: cursor変更でpaginationに重複や欠落が生じる。
  - Mitigation: 同一timestamp、前後page、改ざんcursor、tenant分離をintegration/E2Eで維持する。
- Risk: dormant clientが旧queryを送る。
  - Mitigation: rolling behaviorを曖昧にせず400でfail closedし、API契約を更新する。

## Verification

- [x] `pnpm check`
- [x] `pnpm test:unit:coverage`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] Quality / Database / E2E / Securityがexact headで成功

## Result

Slide collection APIを作成日時順・20件単位の一覧へ限定し、本文substring検索、
recent mode、query binding、性能計測scriptを削除した。`q`、`mode`、未知・重複queryは
400で拒否する。tenant scope、strict cursor、認可、no-storeは維持している。

最終検証はunit 435件、component 98件、integration 127件、E2E 33件、production
build、security audit、license checkが成功した。DB migration、dependency、
production操作はない。
