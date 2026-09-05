# スライド本文を選択範囲ごとにWYSIWYG編集できるようにする

## Issue

- Issue: #479
- Branch: `codex/issue-479`
- Base commit: `1674e9f02617c48d09b7958417694f4494b9c958`

## Outcome

テキストSlideを16:9面で直接編集し、文字サイズ、太字、斜体、下線、文字揃え、箇条書きを保存できる。既存plain text Slideとimage Slideを維持し、editor、preview、detail、audienceが同じdocumentとfit規則を表示する。

## Context

- 現行editorは`src/app/slides/slide-editor.tsx`のcontrolled textarea、表示は`slide-text.tsx`の単一`pre`。
- `slides.body`はplain textで、Issue #424の1 Slide = 1 surfaceと#440/#442の表示契約を保持する。
- Product ownerは2026-09-05にTiptap 3（ProseMirror）を第一実装候補として承認した。
- Issue #479のlibrary再評価とPoC gateがimplementation readinessを定義する。

## Constraints

- application-owned `SlideTextDocumentV2`をcanonicalにし、Tiptap JSONやraw HTMLをAPI/DB契約にしない。
- existing `body`はdocumentから導出する互換値として保持し、既存rowはnormal sizeとしてlazy-upgradeする。
- tenant、revision、origin、physical deletion、projection fail-closed、image quotaの境界を維持する。
- schema/APIはexclusive scope。Issue #478の別worktreeには触れない。
- production migration/deployとproduction data操作は行わない。

## Non-goals

- 色、font family、リンク、埋め込み、複数text box、ページ分割、collaboration。
- image Slideの機能拡張。
- production rollout。

## Plan

1. [x] Tiptap最小packageをexact pinし、document adapter、IME/LF/selection/font-sizeのPoC testsを通す。
2. [x] `SlideTextDocumentV1`のstrict parser/normalizer/flatteningとrecord/API型を実装する。
3. [x] forward migration、Prisma mapping、repositoryのatomic document/body保存とrollback compatibilityを実装する。
4. [x] 16:9 WYSIWYG editor、accessible toolbar、plain paste、preview stale/error statesを実装する。
5. [x] allowlist read rendererと共有fitをdetail/audienceへ統合しprojection回帰を通す。
6. [x] ADR/product/data/security/testing docsを実装と同期する。
7. [x] narrow tests、integration/E2E、canonical checks、diff/security reviewを完了する。
8. [x] focused commits、PR、Issue handoffを完了する。exact-head CIはPR #487で実行する。
9. [x] Product ownerの2026-09-06 clarificationに従い、V2 block/mark contractとTiptapのrich-text toolbarを実装する。
10. [x] V2のdomain/component/integration/E2Eとcanonical checksを実行し、PR/Issue evidenceを更新する。
11. [x] Product ownerの2026-09-06追加確認に従い、文字サイズselectの表示切れを直し、60〜220%を10%刻みで選択・保存できるようにする。
12. [x] Product ownerの試用結果に従い、見出しUI・Tiptap extension・V2 nodeを削除する。
13. [x] Product ownerの確認に従い、未リリースのV1 document互換をdomain/API/DBから削除する。

## Progress

- 2026-09-05 23:25 JST — `origin/main`から専用worktree/branchを作成し、writer leaseを取得。Issue、governance、ADR 0015/0016、slide contract、security、testing、Next.js 16.3.3のClient Component/lazy-loading docsと現行Slide実装を確認。
- 2026-09-05 23:55 JST — Tiptap 3.31.3、versioned document、expand-first migration、16:9 editor、allowlist renderer、preview/audience integration、ADR 0017を実装。canonical check、138 integration tests、backup rehearsal、security check、buildが成功。
- 2026-09-05 23:55 JST — full E2Eは#479対象を含む34/35が成功。equal-timestamp fixtureとrandom UUID tie-breakの既存flaky assertionだけが失敗し、follow-up #486へ分離。
- 2026-09-06 00:30 JST — Product ownerがrich-text scope（文字サイズ、太字、斜体、下線、文字揃え、見出し、箇条書き）を確定。既存V1を読みつつV2を保存するdomain/DB contract、Tiptap extensions/toolbar、allowlist rendererを実装し、typecheckとnarrow unit testsが成功。
- 2026-09-06 00:40 JST — Product ownerの画面確認を反映し、大型ボタン列を一般的な一体型toolbar（段落/size select、compact icon controls）へ変更。編集面へ常時境界、16:9 label、empty placeholder、hover/focus stateを追加し、Chromeで1,092×614pxの編集面と73.68pxの基準文字サイズを確認。
- 2026-09-06 00:55 JST — 文字サイズselectの幅を固定して表示切れを防ぎ、選択可能な範囲を60〜220%の10%刻みへ拡張。V1の75/125%は読取互換として保持する。
- 2026-09-06 01:00 JST — Product ownerが見出し機能を不要と判断。段落style select、Heading extension、V2 heading nodeとread rendererを削除した。
- 2026-09-06 01:10 JST — Product ownerがV1は本番未リリースと確認。V1 parser/adapter/rendererと75/125%互換を削除し、plain `body`からV2を構築する境界だけを維持した。

## Decisions

- 2026-09-05 — TiptapをUI adapterとして採用し、domain/storageから隔離する。
  - Reason: 公式のselection FontSize、React 19対応、ProseMirror schema、MIT、現行maintenance/adoption。
  - Alternatives: Lexical、Plate、Quill、direct ProseMirrorはIssue #479の比較表に記録。
  - ADR: 新規ADRで確定する。
- 2026-09-05 — 保存形式はTiptap JSONではなくversioned run/break documentとする。
  - Reason: library upgradeとuntrusted HTMLをdurable data contractから分離する。
- 2026-09-06 — V1を維持し、rich block/markをV2として追加する。
  - Reason: 既存保存データを移行せず読める状態を維持し、raw Tiptap JSONではなく製品が許可した書式だけを永続化する。
- 2026-09-06 — 本番未リリースのV1 document互換を削除し、保存形式をV2だけにする。
  - Reason: Product ownerがV1互換は不要と確認したため。既存plain `body`からV2を構築する境界は維持する。

## Risks and mitigations

- Risk: contenteditableのIME、selection、undoがfit再計算で壊れる。
  - Mitigation: DOMを置換せずCSS変数でfitし、component/E2Eで日本語compositionとselectionを検証する。
- Risk: plain bodyとrich documentが不整合になる。
  - Mitigation: serverがbodyを導出し同一transactionで保存。旧writer rollbackをDB trigger/integration rehearsalでfail-safeにする。
- Risk: rich pasteが任意markup/styleを持ち込む。
  - Mitigation: plain-text paste/dropとstrict document parser、allowlist React rendererを使う。

## Verification

- [x] `pnpm test:unit` — 528 passed
- [x] `pnpm test:component` — 120 passed
- [x] `pnpm db:check`
- [x] `pnpm test:integration` — 140 passed
- [x] `pnpm test:e2e` — 35 passed
- [x] `pnpm security:check` — audit and 356 license records passed
- [x] `pnpm backup:rehearse` — `slides_reconciled=true`, RTO 4 seconds
- [x] `pnpm check`
- [x] `git diff --check`
- [x] Final diff review for scope, secrets, migrations, rollback and unsafe HTML

## Handoff or blockers

- Completed: implementation、migration、documentation、canonical/integration/security/backup verification。
- Remaining: PR #487のexact-head protected CIとhuman review。
- Blocker: なし。
- Resume with: review PR #487 and confirm protected CI at its exact head。

## Result

実装とlocal verificationは完了し、PR #487へhandoffした。production rolloutは行っていない。
