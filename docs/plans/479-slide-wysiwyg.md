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

- application-owned `SlideTextDocument`をcanonicalにし、Tiptap JSONやraw HTMLをAPI/DB契約にしない。
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
2. [x] Slide text documentのstrict parser/normalizer/flatteningとrecord/API型を実装する。
3. [x] forward migration、Prisma mapping、repositoryのatomic document/body保存とrollback compatibilityを実装する。
4. [x] 16:9 WYSIWYG editor、accessible toolbar、plain paste、preview stale/error statesを実装する。
5. [x] allowlist read rendererと共有fitをdetail/audienceへ統合しprojection回帰を通す。
6. [x] ADR/product/data/security/testing docsを実装と同期する。
7. [x] narrow tests、integration/E2E、canonical checks、diff/security reviewを完了する。
8. [x] focused commits、PR、Issue handoffを完了する。exact-head CIはPR #487で実行する。
9. [x] Product ownerの2026-09-06 clarificationに従い、rich-text block/mark contractとTiptapのtoolbarを実装する。
10. [x] rich-text documentのdomain/component/integration/E2Eとcanonical checksを実行し、PR/Issue evidenceを更新する。
11. [x] Product ownerの2026-09-06追加確認に従い、文字サイズselectの表示切れを直し、60〜220%を10%刻みで選択・保存できるようにする。
12. [x] Product ownerの試用結果に従い、見出しUI・Tiptap extension・heading nodeを削除する。
13. [x] Product ownerの確認に従い、未リリースの先行document互換をdomain/API/DBから削除する。
14. [x] Product ownerの追加確認に従い、保存する文字サイズ範囲を50〜200%の10%刻みに変更する。
15. [x] Product ownerの確認に従い、Slide投影コントローラーの一時的な「文字＋」「文字－」機能を削除する。
16. [x] Product ownerの正式採用判断に従い、製品・コード上の名称をversion付き名称から`SlideTextDocument`へ統一する。

## Progress

- 2026-09-05 23:25 JST — `origin/main`から専用worktree/branchを作成し、writer leaseを取得。Issue、governance、ADR 0015/0016、slide contract、security、testing、Next.js 16.3.3のClient Component/lazy-loading docsと現行Slide実装を確認。
- 2026-09-05 23:55 JST — Tiptap 3.31.3、versioned document、expand-first migration、16:9 editor、allowlist renderer、preview/audience integration、ADR 0017を実装。canonical check、138 integration tests、backup rehearsal、security check、buildが成功。
- 2026-09-05 23:55 JST — full E2Eは#479対象を含む34/35が成功。equal-timestamp fixtureとrandom UUID tie-breakの既存flaky assertionだけが失敗し、follow-up #486へ分離。
- 2026-09-06 00:30 JST — Product ownerがrich-text scope（文字サイズ、太字、斜体、下線、文字揃え、見出し、箇条書き）を確定。versioned domain/DB contract、Tiptap extensions/toolbar、allowlist rendererを実装し、typecheckとnarrow unit testsが成功。
- 2026-09-06 00:40 JST — Product ownerの画面確認を反映し、大型ボタン列を一般的な一体型toolbar（段落/size select、compact icon controls）へ変更。編集面へ常時境界、16:9 label、empty placeholder、hover/focus stateを追加し、Chromeで1,092×614pxの編集面と73.68pxの基準文字サイズを確認。
- 2026-09-06 00:55 JST — 文字サイズselectの幅を固定して表示切れを防ぎ、選択可能な範囲を60〜220%の10%刻みへ拡張。V1の75/125%は読取互換として保持する。
- 2026-09-06 01:00 JST — Product ownerが見出し機能を不要と判断。段落style select、Heading extension、heading nodeとread rendererを削除した。
- 2026-09-06 01:10 JST — Product ownerが先行document形式は本番未リリースと確認。そのparser/adapter/rendererと75/125%互換を削除し、plain `body`から現行documentを構築する境界だけを維持した。
- 2026-09-06 01:35 JST — Product ownerが保存する文字サイズ範囲を50〜200%の10%刻みに変更するよう確認した。投影時の一時的な全体倍率60〜220%は別責務として維持する。
- 2026-09-06 08:50 JST — Product ownerが保存済み書式と重複するSlide投影時の「文字＋」「文字－」機能を不要と判断。Scriptureの既存font controlsは対象外として維持する。
- 2026-09-06 09:10 JST — Product ownerが現行document形式を正式採用。JSONの`version`はschema discriminatorとして維持し、コードと製品文書の名称を`SlideTextDocument`へ統一した。
- 2026-09-06 11:10 JST — version付き型alias・schema/helper名・製品上のV2表記を削除。unit 530件、component 120件、typecheck、`git diff --check`が成功した。
- 2026-09-06 11:40 JST — PR全体を再レビュー。toolbarをeditor lifecycleから分離し、selectionだけの変更ではtext fitを再計算しないよう責務を分け、到達不能な旧size表示を削除した。migration統合は既存の適用履歴を使うrehearsalが失敗したため取り消した。
- 2026-09-06 11:55 JST — Tiptap公式の`useEditorState`でtoolbar更新を購読し、document versionとfont-sizeの変換を型付き境界へ集約。integration 140件、security、backup rehearsalが成功。E2Eは対象flowを含む34件が成功し、既知の#486だけが再現した。

## Decisions

- 2026-09-05 — TiptapをUI adapterとして採用し、domain/storageから隔離する。
  - Reason: 公式のselection FontSize、React 19対応、ProseMirror schema、MIT、現行maintenance/adoption。
  - Alternatives: Lexical、Plate、Quill、direct ProseMirrorはIssue #479の比較表に記録。
  - ADR: 新規ADRで確定する。
- 2026-09-05 — 保存形式はTiptap JSONではなくversioned run/break documentとする。
  - Reason: library upgradeとuntrusted HTMLをdurable data contractから分離する。
- 2026-09-06 — 本番未リリースの先行document互換を削除し、現行形式だけを保存する。
  - Reason: Product ownerが先行形式の互換は不要と確認したため。既存plain `body`から現行documentを構築する境界は維持する。
- 2026-09-06 — 正式名称を`SlideTextDocument`とし、version付き型名を使わない。
  - Reason: 現行形式が正式採用されたため。JSONの`version`は将来のschema migrationに必要な内部識別子として維持する。
- 2026-09-06 — 既に適用・検証されたmigration履歴は統合しない。
  - Reason: 統合案では既存の開発・rehearsal DBに記録されたmigration checksumと不一致になり、`pnpm test:integration`のbackup移行rehearsalが失敗したため。
  - Alternatives: 3段階を正式schema追加の1本へ統合する案は、適用済み環境との互換性を壊すため取り消した。

## Risks and mitigations

- Risk: contenteditableのIME、selection、undoがfit再計算で壊れる。
  - Mitigation: DOMを置換せずCSS変数でfitし、component/E2Eで日本語compositionとselectionを検証する。
- Risk: plain bodyとrich documentが不整合になる。
  - Mitigation: serverがbodyを導出し同一transactionで保存。旧writer rollbackをDB trigger/integration rehearsalでfail-safeにする。
- Risk: rich pasteが任意markup/styleを持ち込む。
  - Mitigation: plain-text paste/dropとstrict document parser、allowlist React rendererを使う。

## Verification

- [x] `pnpm test:unit` — 530 passed
- [x] `pnpm test:component` — 120 passed
- [x] `pnpm db:check`
- [x] `pnpm test:integration` — 140 passed
- [x] `pnpm test:e2e` — 35 passed
- [x] `pnpm security:check` — audit and 356 license records passed
- [x] `pnpm backup:rehearse` — `slides_reconciled=true`, RTO 4 seconds
- [x] `pnpm check`
- [x] `git diff --check`
- [x] Final diff review for scope, secrets, migrations, rollback and unsafe HTML
- [x] PR #487 exact-head protected CI — Quality、Database、E2E、Security passed

## Handoff or blockers

- Completed: implementation、migration、documentation、canonical/integration/security/backup verification。
- Remaining: PR #487のhuman review。
- Blocker: なし。
- Resume with: review PR #487。

## Result

実装、local verification、PR #487のexact-head protected CIは完了した。production rolloutは行っていない。
