# お気に入りの終了節省略状態を保存・復元する

## Issue

- Issue: #245
- Branch: `codex/issue-245`
- Base commit: `da586f0`

## Outcome

終了節を省略したお気に入りは省略状態を失わず、選択時に検索フォームの終了節が空欄になる。明示した終了節は従来どおり復元される。

## Context

- `scripture_bookmarks.end_verse` は現在NOT NULLで、省略時も開始節と同じ値を保存している。
- `normalizeScriptureFavorite` は省略を単一節へ変換している。
- お気に入りタイトルは自動生成され編集不可であり、既存の範囲省略タイトルは末尾に `-終了節` を含まない。
- データベース規約はドメイン上の不在をNULLで表現する。

## Constraints

- 前方マイグレーションのみを追加し、既存マイグレーションは変更しない。
- 既存の明示範囲とBible endpoint外部キーを維持する。
- 本番適用は行わない。
- 新規依存関係を追加しない。

## Non-goals

- 終了節省略時のOpen検索範囲変更。
- お気に入りタイトルや画面デザイン変更。

## Plan

1. [x] `end_verse` をnullableにする前方マイグレーションとPrisma・データ辞書を更新する。
2. [x] 保存ドメイン、カタログ検証、repository mapperをnullable終了節へ対応する。
3. [x] 省略時はNULLで保存し、検索フォームでは空欄へ復元する。
4. [x] 単体、コンポーネント、統合、Chrome E2Eで省略・明示の両方を検証する。
5. [x] ローカルDBへマイグレーションを適用し、既存お気に入りの補正を確認する。
6. [ ] PRと必須CIを通過させてマージする。

## Progress

- 2026-08-24 11:57 JST — Issue #245を作成。省略状態がNOT NULLの終了節へ開始節と同値で保存され、復元不能になる根本原因を確認した。
- 2026-08-24 12:03 JST — 前方マイグレーションをテストDBとローカルDBへ適用。ローカルの省略お気に入り2件をNULLへ補正し、未補正0件を確認した。
- 2026-08-24 12:06 JST — 単体254件、コンポーネント43件、統合77件、Chrome E2E 13件、セキュリティ検査、production buildが通過した。

## Decisions

- 2026-08-24 — Decision: `end_verse = NULL` を終了節省略の正式な表現にする。
  - Reason: データベース規約に沿い、タイトル推測や別のフラグなしで不在を直接表現できる。
  - Alternatives: クライアントでタイトル末尾を推測する案は表示文字列へ永続化規則が依存するため採用しない。Boolean列はNULLと意味が重複するため採用しない。

## Risks and mitigations

- Risk: NULLにより終了節外部キー検証が適用されない。
  - Mitigation: 開始節外部キーは維持し、省略時の実効終了節を開始節としてカタログ検証する。
- Risk: 既存のお気に入りの省略判定を誤る。
  - Mitigation: 編集不可の自動生成タイトル末尾に明示範囲があるかだけを前方マイグレーションで判定し、統合テストで補正結果を確認する。

## Verification

- [x] `pnpm db:schema:check`（`pnpm db:check` 内で実施）
- [x] `pnpm check`
- [x] `pnpm test:integration`
- [x] `pnpm test:e2e`
- [x] `pnpm security:check`
- [x] `git diff --check`
- [x] 最終差分をデータ損失、locking、forward recovery、互換性、秘密情報の観点で確認する。

## Handoff or blockers

- Completed: 原因調査、migration、domain/repository/UI、テスト、ローカルDB補正。
- Remaining: PR、CI、マージ。
- Blocker: なし。
- Resume with: 変更をcommitしPRを作成する。

## Result

未完了。
