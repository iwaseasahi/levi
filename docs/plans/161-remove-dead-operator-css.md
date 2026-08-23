# Issue #161: 未使用 operator resolver と dead CSS を削除する

## Issue

- GitHub Issue: #161
- Branch: `codex/issue-161`
- Base SHA: `ed209bb8c804f8e3890a811736c4bcd9488991d3`

## Outcome

Basic Auth 移行前の未使用認証コードと、画面から参照されない CSS を除去し、以後のリファクタ対象を現行機能だけに絞る。

## Context

`resolveOperatorAccess` と依存 interface はテスト以外から参照されない。一方、`OperatorAccess` 型は現行 Basic Auth の境界で利用される。`styles.css` にはソース・テストから参照されない class selector が 19 個残る。

## Constraints

- `OperatorAccess` 型は維持する。
- 動的 class、Ginmaku 互換 selector、疑似要素を誤って削除しない。
- 挙動と表示を変更しない。

## Non-goals

- CSS ファイルの分割
- 認証方式やアクセス判定の変更
- 使用中スタイルの再設計

## Plan

1. resolver/interface と class selector の全参照をリポジトリ全体で確認する。
2. 未使用 resolver/interface/test を削除し、利用中の型を維持する。
3. 参照のない 19 class selector だけを shared rule から安全に切り離して削除する。
4. component、E2E、axe、ビルドで主要画面と保護ルートを回帰検証する。
5. 必須 CI を通してマージする。

## Progress

- 2026-08-23: Issue、branch、worktree、writer lease を準備。
- 2026-08-23: resolver は unit test 以外に参照がなく、`OperatorAccess` 型のみ本番利用されることを確認。
- 2026-08-23: ソース・テスト参照のない class selector 19 個を抽出。
- 2026-08-23: resolver/interface/test と dead selector 19 個を削除し、未参照 class の再抽出結果が 0 件であることを確認。
- 2026-08-23: 全体チェック、coverage、Playwright E2E 9 件、E2E 内 axe、セキュリティチェックが成功。

## Decisions

- selector 名の部分一致ではなく class token の完全一致で参照を確認する。
- shared rule は利用中 selector の宣言を残し、未使用 selector だけを除く。

## Risks

- CSS Modules ではないため動的 class の見落としが主なリスク。静的参照確認に加えて主要画面の E2E と axe を必須とする。

## Verification

- 未使用 selector 再抽出
- `pnpm check`
- `pnpm test:e2e`
- `pnpm security:check`
- `git diff --check`
