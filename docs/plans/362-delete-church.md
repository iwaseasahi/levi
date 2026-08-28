# Issue #362: 管理画面から教会を安全に削除する

## Goal

管理者が対象教会を明示的に確認したうえで、教会、保存データ、所属する全利用者、各利用者の認証状態を一つのトランザクションで物理削除できるようにする。共有の聖書マスター、他教会、管理者データは保持する。

## Plan

- [x] 既存の教会・利用者・保存データ・認証データの所有関係と削除制約を確認する。
- [x] 教会削除のアプリケーションサービス、コントローラー、監査イベント、Prismaトランザクションを実装する。
- [x] 教会名の再入力を必須にする確認UIと、待機・エラー表示を教会一覧へ追加する。
- [x] 単体・コンポーネント・統合テストで認可、確認、複数利用者、保存データ、共有データ保持を検証する。
- [x] データモデル文書を複数利用者の削除仕様へ更新し、全チェックを実行する。
- [ ] PRを作成し、必須CI通過後にマージしてIssueを閉じる。

## Decisions

- 教会名の完全一致をクライアントとサーバーの両方で検証する。
- ChurchのCASCADEで所属・フォルダー・お気に入りを削除した後、同一トランザクション内で所属していたUserを明示的に削除する。UserのCASCADEでAccountとSessionを削除する。
- Better Authのパスワード再設定VerificationはUserへの外部キーを持たないため、`value` が対象User IDの行を明示的に削除する。
- BibleTranslation、BibleBook、BibleVerse、AdminUserは教会所有ではないため削除しない。

## Verification

- Targeted unit/component tests: 16 tests passed
- `pnpm test:integration`: 91 tests passed
- `pnpm check`: formatting, lint, typecheck, unit/component tests, configuration checks, and production build passed
- `pnpm test:e2e`: 19 tests passed
- `pnpm security:check`: no known vulnerabilities; production dependency licenses approved
- `git diff --check`: passed
- GitHub required checks: `Quality`, `Database`, `E2E`, `Security`
