# お気に入りから聖書検索条件を復元する

## Issue

- Issue: #243
- Branch: `codex/issue-243`
- Base commit: `efb9304a7686c852b0667416a22eda8bbce50ea0`

## Outcome

保存済みのお気に入りを選択すると検索フォームへ条件が復元され、その後の `Open` 操作だけが投影画面を開く。

## Context

- `src/app/church/saved-content-panel.tsx` は現在、お気に入りリンクから `openBookmark` を呼ぶ。
- `src/app/church/use-saved-content-controller.ts` はAPIの `open-bookmark` 後に投影コールバックを呼ぶ。
- `src/app/church/use-scripture-catalog.ts` が検索フォームとカタログ候補の状態を所有する。
- `docs/product/initial-release-spec.md` と `docs/product/scripture-search-contract.md` には直接投影する旧仕様が残っている。

## Constraints

- APIの `open-bookmark` による最近使用日時更新を維持する。
- 既存の保存、並べ替え、フォルダー操作を変更しない。
- 投影は既存の `Open` 操作を通す。
- データベース変更と新規依存関係は行わない。

## Non-goals

- お気に入りやフォルダーのデザイン変更。
- 投影画面の表示・操作変更。

## Plan

1. [x] お気に入り選択を検索条件コールバックへ変更し、カタログ状態に保存条件を復元する。
2. [x] コンポーネントテストで直接投影されず全条件が復元されることを確認する。
3. [x] Chrome E2EをGinmakuの「選択後にOpen」操作順へ更新する。
4. [x] プロダクト仕様とパリティ記録を新しい確定仕様へ更新する。
5. [x] 全検証、PR作成、必須CI通過まで完了してマージ可能な状態にする。

## Progress

- 2026-08-24 11:41 JST — Issue #243を作成し、現行の直接投影経路と関連仕様・テストを確認した。
- 2026-08-24 11:45 JST — 検索条件復元へ変更し、対象コンポーネント22件とChrome E2E 13件が通過した。初回E2Eは既存ローカルサーバーとの競合で開始前に停止し、サーバー停止後の再実行で通過した。
- 2026-08-24 11:51 JST — PR #244のDatabase、E2E、Quality、Securityがすべて通過した。

## Decisions

- 2026-08-24 — Decision: `open-bookmark` APIは維持し、返された検索条件をフォーム状態へ渡す。
  - Reason: 最近使用日時の更新を維持しながら、投影だけを明示的な `Open` へ分離できる。
  - Alternatives: APIを呼ばず画面内データだけで復元する案は、最近使用日時が更新されないため採用しない。

## Risks and mitigations

- Risk: 書巻・章だけが復元され、節候補の読み込み前に開始節・終了節が消える。
  - Mitigation: 検索条件と対応するカタログ応答を一貫して反映し、コンポーネントとE2Eで全項目を確認する。
- Risk: お気に入り選択が投影タブを作る旧挙動が残る。
  - Mitigation: 新規タブが増えないことをE2Eで明示的に検証する。

## Verification

- [x] `pnpm check` — unit 253件、component 43件、buildを含めて通過。
- [x] `pnpm test:integration` — 77件通過。
- [x] `pnpm test:e2e` — Chrome 13件通過。
- [x] `pnpm security:check` — vulnerabilityなし、production license 314件承認済み。
- [x] `git diff --check` — 通過。
- [x] 最終差分をスコープ、秘密情報、マイグレーション、安全でない既定値の観点で確認した。

## Handoff or blockers

- Completed: 実装、全ローカル検証、仕様・パリティ文書更新、最終差分確認。
- Remaining: PR #244のマージとIssue close確認。
- Blocker: なし。
- Resume with: PR #244をマージする。

## Result

お気に入り選択時の検索条件復元、明示的な`Open`まで投影しない動作、仕様文書、回帰テストを実装した。ローカル検証とPR #244の必須CIはすべて通過し、マージ可能な状態である。
