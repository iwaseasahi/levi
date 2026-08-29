# 聖書検索画面の上下キーで投映画面を操作する

## Issue

- Issue: #370
- Branch: `codex/issue-370`
- Base commit: `e8f6e5567c0b09faa84e78e4351141ef7e562ace`

## Outcome

会衆向け投影タブを開いたまま聖書検索画面を操作しているとき、修飾キーなしの上矢印で前、下矢印で次の御言葉へ移動できる。

## Context

- 検索画面の投影操作ボタンは `useDirectAudienceController.control` から同一originの投影タブへ制御messageを送る。
- 投影タブ自身には上下キーによる前後移動が実装済みだが、検索画面には同じshortcutがない。
- フォルダー内bookmarkには `Alt + ArrowUp/ArrowDown` の並べ替え操作がある。

## Constraints

- 投影操作ボタンと同じpostMessage制御経路を再利用する。
- 投影タブがREADYを返す前は矢印キーを奪わない。
- `Alt`、`Control`、`Meta`、`Shift` 付きの矢印キーとIME変換中の入力を奪わない。
- 既存の投影デザイン、navigation境界、左右キー、文字サイズshortcutは変更しない。

## Plan

1. [x] controller hookでREADY時だけ修飾キーなしの上下キーを前後制御へ変換する。
2. [x] component testでREADY前、READY後、default抑止、修飾キー競合回避を検証する。
3. [x] E2Eで検索画面にフォーカスした状態から投影内容が前後移動することを検証する。
4. [ ] applicable local checks、exact-head CI、merge、Issue closeを完了する。

## Progress

- 2026-08-29 — Issue #370、governance、Next.js client component docs、既存controller/audience keyboard実装とテストを確認した。
- 2026-08-29 — READY後の検索画面keydownを既存controlへ接続し、component 65件とChromium E2E 18件を完了した。
- 2026-08-29 — canonical check、integration 84件、security check、whitespace checkを完了した。

## Decisions

- 2026-08-29 — Decision: `useDirectAudienceController.control` をkeyboardとbuttonで共有する。
  - Reason: READY判定、expected window、same-origin制御、error handlingを重複させないため。
- 2026-08-29 — Decision: 修飾キー付き矢印とIME変換中は無視する。
  - Reason: 既存のbookmark並べ替えとOS/browserのshortcutを維持するため。

## Risks and mitigations

- Risk: 矢印キーで検索画面がscrollしたりradio選択が変わったりする。
  - Mitigation: READY後に処理する上下キーだけ `preventDefault()` し、component/E2Eで検証する。
- Risk: audience未起動でも通常の検索画面操作を阻害する。
  - Mitigation: READY前はeventを処理せず、component testで確認する。

## Verification

- [x] `pnpm test:component -- src/app/church/scripture-search.component.test.tsx`（65 passed）
- [x] `pnpm test:e2e`（18 passed）
- [x] `pnpm check`
- [x] `pnpm test:integration`（84 passed）
- [x] `pnpm security:check`（known vulnerabilityなし、315 license records承認済み）
- [x] `git diff --check`
- [ ] exact-head required CI
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: intake、Issue作成、branch/lease、設計、実装、全local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: commitをpushしてPRを作成する。

## Result

実装完了時に更新する。
