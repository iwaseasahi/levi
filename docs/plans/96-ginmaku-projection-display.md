# Ginmakuと同じ会衆向け投映画面を通常タブで提供する

## Issue

- Issue: #96
- Branch: `codex/issue-96`
- Base commit: `ff053fdb59dc4040bc8f05f0ca39ec2442cf76ab`

## Outcome

会衆向け画面が最新版Chromeの通常タブで開き、Ginmakuの固定済み実装と同じ黒背景、黄色見出し・節番号、白本文、青い影、日英順序、中央配置、自動縮小で御言葉を表示する。

## Context

- `src/app/church/projection/projection-controller.tsx` はpopup feature付きのnamed windowを開いている。
- `src/app/church/audience/audience-display.tsx` と `src/app/styles.css` はLevi独自の翻訳label・区切り線・文字組みを表示している。
- `src/domain/projection/state.ts` のversion 1 payloadにはGinmaku形式の章見出しと節番号がない。
- Binding referenceはIssue #96に固定したGinmaku commit `4b18adb02ac8011630c76137c60038e168f05534`。

## Constraints

- 既存のsame-origin/opener検証、session fail-closed、current-item-only transportを弱めない。
- next/previous、文字サイズ、スクロール、暗転、再接続を維持する。
- 許可済みE2E fixture以外の聖書本文をartifactへ追加しない。
- production deploymentは行わない。

## Non-goals

- 操作画面全体のGinmaku化
- 認証、検索、navigationの仕様変更
- hymn、slide機能

## Plan

1. [x] 通常タブを開く操作とversion 2の最小投影payloadを実装する。
2. [x] GinmakuのDOM・配色・文字組み・日英順序・自動縮小を実装する。
3. [x] protocol/unit/component/latest-Chromium E2Eを更新して回帰を検証する。
4. [ ] canonical checks、PR exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-21 11:20 JST — Issue #96、parent #38、governance、projection protocol、現行実装とテスト、固定済みGinmaku実装を確認した。
- 2026-08-21 23:45 JST — 通常タブ、protocol v2、Ginmaku DOM/CSS、自動縮小を実装。unit 142件、component 24件、latest-Chromium E2E 9件、typecheck、lint、diff checkが成功した。

## Decisions

- 2026-08-21 — Decision: `window.open('/church/audience', '_blank')` を使用し、window featuresを渡さない。
  - Reason: 通常の新規Chromeタブを要求する意図を直接表現し、controllerは返されたWindow参照で安全な通信を維持できる。
  - Alternatives: named targetとpopup featuresの維持は通常タブ要件に反する。
- 2026-08-21 — Decision: protocolをversion 2へ上げ、`heading` と `verseNumber` を必須化する。
  - Reason: 表示側で翻訳名やreference文字列を解析せず、固定されたGinmaku形式を安全に描画するため。
  - Alternatives: version 1へのoptional field追加は異なる契約を同じversionとして扱う。

## Risks and mitigations

- Risk: 長文がviewportからはみ出す。
  - Mitigation: Ginmakuと同じ0.95刻みの自動縮小とlatest-Chromium E2Eで検証する。
- Risk: protocol更新でcontroller/audienceが同期しない。
  - Mitigation: strict parser unit test、handshake component test、E2E再接続testを実行する。

## Verification

- [x] `pnpm test:unit` — 142 passed
- [x] `pnpm test:component` — 24 passed
- [x] `pnpm test:e2e` — 9 passed
- [ ] `pnpm check`
- [ ] `pnpm test:integration`
- [ ] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: 実装、unit/component/latest-Chromium E2E、typecheck、lint。
- Remaining: canonical full check、PR、exact-head CI、merge。
- Blocker: none。
- Resume with: diff review後のcommitとPR作成。

## Result

実装完了時に更新する。
