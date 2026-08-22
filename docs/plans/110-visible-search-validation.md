# 聖書検索の未入力エラーを明瞭に表示する

## Issue

- Issue: #110
- Branch: `codex/issue-110`
- Base commit: `eca455da46399eb287922eb5bc459e62d687ed72`

## Outcome

検索必須項目が未入力のままOpenされた場合、対象項目を明示するエラーを黒いGinmaku画面上で判読できる配色により表示する。

## Context

- `src/app/church/scripture-search.tsx`は現在、必須項目をまとめたmessageを表示する。
- `src/app/styles.css`の`.search-feedback p { color: #fff }`が淡い`.notice-error`背景にも適用され、本文contrastが不足する。
- 添付画像は期待デザインではなく、修正対象の不具合証跡として扱う。

## Constraints

- Ginmaku検索画面の全体デザインと既存alert focusを維持する。
- 検索、direct audience、database contractは変更しない。

## Non-goals

- 検索フォーム全体の再デザイン。
- browser native validationへの置換。

## Plan

1. [x] 書巻、章、開始節ごとのrequired messageを実装する。
2. [x] error notice本文へ明瞭なcontrastを設定する。
3. [x] component/E2Eでmessage、focus、computed colorsを固定する。
4. [ ] canonical checksとexact-head CI成功後にmergeする。

## Progress

- 2026-08-22 10:43 JST — Issue #110、current validation、CSS cascade、添付不具合画像を確認した。
- 2026-08-22 10:45 JST — Field-specific messagesとscoped dark-red textを実装し、component 34、unit 145、integration 72、Chromium E2E 9、build、database、security checksが成功した。

## Decisions

- 2026-08-22 — Decision: missing fieldの先頭を個別messageで示す。
  - Reason: 選択済み項目を再度要求するgeneric messageより修正箇所が明確になる。
- 2026-08-22 — Decision: error本文をdark red、背景を既存のpale redとする。
  - Reason: Ginmaku black surfaceとの境界を保ちつつnotice内部のcontrastを確保できる。

## Risks and mitigations

- Risk: global notice style変更がadmin画面へ影響する。
  - Mitigation: `.search-feedback .notice-error`配下だけをscopeする。

## Verification

- [x] `pnpm check`
- [x] explicit port 55433 `pnpm test:integration` — 72 passed
- [x] explicit port 55433 `pnpm test:e2e` — 9 passed
- [x] `pnpm db:check`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [ ] exact-head required CI

## Handoff or blockers

- Completed: intake、worktree、lease、root-cause investigation、implementation、local verification。
- Remaining: PR、exact-head CI、merge。
- Blocker: none。
- Resume with: final diff review、commit、push、PR、required CI監視。

## Result

書巻、章、開始節のmissing fieldを個別に案内し、検索error notice本文へdark red `#8f1d1d`、既存背景`#fff8f7`を適用した。Alert focusと支援技術通知を維持し、latest Chromiumでmessageとcomputed colorsを固定した。
