# Issue #160: リファクタ前の挙動・カバレッジ基準を固定する

## Issue

- GitHub Issue: #160
- Branch: `codex/issue-160`
- Base SHA: `9647e2bb48a2345c0fa8287d669e434a3f0269d9`

## Outcome

リファクタ対象となるドメイン、アプリケーション、API controller、設定コードのカバレッジが実態を表し、主要利用フローの責務と既存挙動が文書・テストで固定される。

## Context

現在の unit coverage は限定的な明示リストだけを計測しており、未 import の本番コードが数値に現れない。コンポーネントテストには jsdom の canvas 未実装警告も残る。

## Constraints

- 既存の 80% threshold と必須 CI を弱めない。
- production data を fixture に利用しない。
- 製品挙動を変更しない。

## Non-goals

- Playwright E2E ファイルの分割
- アプリケーション構造そのものの変更
- カバレッジ数値を目的にした到達不能分岐のテスト

## Plan

1. unit-testable な本番 TypeScript と現行 coverage 対象の差分を列挙する。
2. coverage include/exclude を責務単位の glob へ変更し、除外理由を文書化する。
3. 新たに可視化された未テスト責務へ characterization test を追加する。
4. login/search/audience/folder/password/tenant の責務対応表を文書化する。
5. component test の canvas 警告を setup で解消する。
6. coverage、全テスト、必須 CI を検証してマージする。

## Progress

- 2026-08-23: Issue、branch、worktree、writer lease を準備。
- 2026-08-23: 現行 coverage が限定的な 5 系統の include に依存することを確認。
- 2026-08-23: `test:unit:coverage` 単独実行には Prisma Client 生成が必要なことを確認。
- 2026-08-23: 未計測だった 4 つの application 責務へ characterization test を追加。
- 2026-08-23: coverage 対象を責務 glob に変更し、92.28% statements / 85.02% branches / 96.82% functions / 93.32% lines で通過。
- 2026-08-23: canvas 警告を除去し、全体チェック・統合テスト・セキュリティチェックが成功。
- 2026-08-23: Playwright E2E 9 件が成功し、既存の主要利用フローに差分がないことを確認。

## Decisions

- coverage 対象は個別ファイル列挙ではなく、ドメイン・アプリケーション・controller・config の責務 glob で管理する。
- UI 表示責務は component test、DB 実装は integration test のゲートで扱い、unit coverage の対象理由と除外理由を明示する。

## Risks

- 対象拡大で threshold を下回る可能性があるため、未テスト責務を先に可視化し、意味のある characterization test を追加する。

## Verification

- `pnpm test:unit:coverage`
- `pnpm test:component`
- `pnpm test:integration`
- `pnpm check`
- `pnpm security:check`
- `git diff --check`
