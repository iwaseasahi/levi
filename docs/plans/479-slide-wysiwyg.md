# スライド本文を選択範囲ごとにWYSIWYG編集できるようにする

## Issue

- Issue: #479
- Branch: `codex/issue-479`
- Base commit: `1674e9f02617c48d09b7958417694f4494b9c958`

## Outcome

テキストSlideを16:9面で直接編集し、選択範囲へ4段階の相対文字サイズを保存できる。既存plain text Slideとimage Slideを維持し、editor、preview、detail、audienceが同じdocumentとfit規則を表示する。

## Context

- 現行editorは`src/app/slides/slide-editor.tsx`のcontrolled textarea、表示は`slide-text.tsx`の単一`pre`。
- `slides.body`はplain textで、Issue #424の1 Slide = 1 surfaceと#440/#442の表示契約を保持する。
- Product ownerは2026-09-05にTiptap 3（ProseMirror）を第一実装候補として承認した。
- Issue #479のlibrary再評価とPoC gateがimplementation readinessを定義する。

## Constraints

- application-owned `SlideTextDocumentV1`をcanonicalにし、Tiptap JSONやraw HTMLをAPI/DB契約にしない。
- existing `body`はdocumentから導出する互換値として保持し、既存rowはnormal sizeとしてlazy-upgradeする。
- tenant、revision、origin、physical deletion、projection fail-closed、image quotaの境界を維持する。
- schema/APIはexclusive scope。Issue #478の別worktreeには触れない。
- production migration/deployとproduction data操作は行わない。

## Non-goals

- 太字、色、font family、alignment、複数text box、ページ分割、collaboration。
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
8. [ ] focused commits、PR、exact-head CI、Issue handoffを完了する。

## Progress

- 2026-09-05 23:25 JST — `origin/main`から専用worktree/branchを作成し、writer leaseを取得。Issue、governance、ADR 0015/0016、slide contract、security、testing、Next.js 16.3.3のClient Component/lazy-loading docsと現行Slide実装を確認。
- 2026-09-05 23:55 JST — Tiptap 3.31.3、versioned document、expand-first migration、16:9 editor、allowlist renderer、preview/audience integration、ADR 0017を実装。canonical check、138 integration tests、backup rehearsal、security check、buildが成功。
- 2026-09-05 23:55 JST — full E2Eは#479対象を含む34/35が成功。equal-timestamp fixtureとrandom UUID tie-breakの既存flaky assertionだけが失敗し、follow-up #486へ分離。

## Decisions

- 2026-09-05 — TiptapをUI adapterとして採用し、domain/storageから隔離する。
  - Reason: 公式のselection FontSize、React 19対応、ProseMirror schema、MIT、現行maintenance/adoption。
  - Alternatives: Lexical、Plate、Quill、direct ProseMirrorはIssue #479の比較表に記録。
  - ADR: 新規ADRで確定する。
- 2026-09-05 — 保存形式はTiptap JSONではなくversioned run/break documentとする。
  - Reason: library upgradeとuntrusted HTMLをdurable data contractから分離する。

## Risks and mitigations

- Risk: contenteditableのIME、selection、undoがfit再計算で壊れる。
  - Mitigation: DOMを置換せずCSS変数でfitし、component/E2Eで日本語compositionとselectionを検証する。
- Risk: plain bodyとrich documentが不整合になる。
  - Mitigation: serverがbodyを導出し同一transactionで保存。旧writer rollbackをDB trigger/integration rehearsalでfail-safeにする。
- Risk: rich pasteが任意markup/styleを持ち込む。
  - Mitigation: plain-text paste/dropとstrict document parser、allowlist React rendererを使う。

## Verification

- [x] `pnpm test:unit` — 520 passed
- [x] `pnpm test:component` — 119 passed
- [x] `pnpm db:check`
- [x] `pnpm test:integration` — 138 passed
- [ ] `pnpm test:e2e` — 34 passed; unrelated existing nondeterministic assertion tracked in #486
- [x] `pnpm security:check` — audit and 348 license records passed
- [x] `pnpm backup:rehearse` — `slides_reconciled=true`, RTO 5 seconds
- [x] `pnpm check`
- [x] `git diff --check`
- [x] Final diff review for scope, secrets, migrations, rollback and unsafe HTML

## Handoff or blockers

- Completed: implementation、migration、documentation、canonical/integration/security/backup verification。
- Remaining: commit、PR、exact-head CI handoff。
- Blocker: full local E2Eの既存flaky assertionは#486。#479対象E2Eは成功。
- Resume with: commit the reviewed diff and open the Issue-linked PR。

## Result

実装とlocal verificationは完了。PR/CI handoffを残す。
