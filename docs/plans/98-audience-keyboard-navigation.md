# 投影タブの上下キーで前後の聖書箇所へ移動する

## Issue

- Issue: #98
- Branch: `codex/issue-98`
- Base commit: `967ed51be809ff1ffe9148cfc08a673dae51abfd`

## Outcome

会衆向け投影タブにフォーカスがあるとき、Ginmakuと同じく上矢印で前、下矢印で次の聖書箇所へ移動し、既存の章・書巻境界越えを利用できる。

## Context

- `src/app/church/audience/audience-display.tsx` はcontrollerからの表示messageだけを受信する。
- `src/app/church/projection/projection-controller.tsx` はbuttonと左右キーを既存の直列navigation queueへ渡す。
- `src/domain/projection/state.ts` のprotocol v2にはaudience起点navigation messageがない。
- Binding referenceはGinmaku commit `4b18adb02ac8011630c76137c60038e168f05534` の `books.js.coffee` と `search.html.erb`。

## Constraints

- #96の投影デザインを変更しない。
- same-origin、expected-window、strict message validation、session fail-closedを維持する。
- navigation domain/APIを複製せず既存queueを利用する。
- test DBは必ずport 55433を明示し、開発DBへintegration fixtureを向けない。

## Non-goals

- 左右キーや他のshortcutの追加
- navigation境界仕様の変更
- production deployment

## Plan

1. [x] Protocol v3へaudience起点のstrict `NAVIGATE` messageを追加する。
2. [x] audienceの上下keydownをmessageへ変換し、controllerの既存queueへ接続する。
3. [x] protocol/component/latest-Chromium E2Eとparity文書を更新する。
4. [ ] 全local check、exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-22 00:10 JST — Issue #98、governance、Next.js client component docs、projection protocol、固定済みGinmaku evidence、現行実装とテストを確認した。
- 2026-08-22 00:16 JST — protocol v3、audience keydown、controller queue接続、unit/component/E2E、parity文書を実装した。
- 2026-08-22 00:21 JST — latest Chromium E2E 9件、unit 142件、component 24件、integration 72件、build、security checkを隔離DBで完了した。

## Decisions

- 2026-08-22 — Decision: audienceからcontrollerへ `NAVIGATE { direction }` を送るprotocol v3とする。
  - Reason: navigation APIをaudienceへ公開せず、controllerの認証・直列queue・境界処理を再利用できる。
  - Alternatives: audienceが直接navigation APIを呼ぶと状態同期とsession処理を重複させる。
- 2026-08-22 — Decision: success/blankのみ上下キーを受け付け、waiting/unauthorizedでは送らない。
  - Reason: Issue #98の状態要件とfail-closed境界を明示する。

## Risks and mitigations

- Risk: controller message listenerが古いrenderのnavigation stateを参照する。
  - Mitigation: latest queue functionをref経由で呼び、連続入力component testを追加する。
- Risk: 矢印キーでbrowser scrollも発生する。
  - Mitigation:処理対象キーだけ `preventDefault()` し、component testで検証する。

## Verification

- [x] `pnpm test:unit`（142 passed）
- [x] `pnpm test:component`（24 passed）
- [x] `pnpm test:e2e`（latest Chromium、9 passed）
- [x] `pnpm check`
- [x] explicit test DB port 55433で`pnpm test:integration`（72 passed）
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake、設計、worktree、lease、実装、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: commitをpushしてPRを作成する。

## Result

実装完了時に更新する。
