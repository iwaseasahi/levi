# Issue #162: 認証 application と Prisma・Better Auth の境界を分離する

## Issue

- GitHub Issue: #162
- Branch: `codex/issue-162`
- Base SHA: `bcb4001dd445bd6f45f80a1a0326cfe7ca7a32f6`

## Outcome

教会作成とパスワードライフサイクルの判断が framework / Prisma / Better Auth から独立し、Server Action とページ認証が薄い adapter になる。

## Context

application use case が Prisma transaction、Better Auth、password hash を直接 import している。パスワード reset / forced-change Server Action には認証、validation、監査 log が混在し、教会向けページには同じ redirect / not-found 判定が重複する。`/scripture` は認証済み church をさらに DB 照会している。

## Constraints

- Basic Auth、30日 session、強制パスワード変更、reset 時の全 session 失効を維持する。
- transaction の serializable 分離レベルと transaction 内再認可を維持する。
- Server Action を直接呼ばれても認証・入力検証を必ず行う。
- schema と認証ライブラリは変更しない。

## Non-goals

- MFA、管理者追加、ログイン方式変更
- DB schema / migration 変更
- UI デザイン変更

## Plan

1. 教会作成に transaction / credential writer の application port を定義し、Prisma・Better Auth adapter を infrastructure へ移す。
2. password lifecycle に transaction / password hasher / temporary-password generator port を定義し、Prisma adapter を infrastructure へ移す。
3. reset と forced-change の controller を application に分離し、Server Action を headers / FormData / logging adapter に限定する。
4. 監査 event に request ID を統一して引き渡し、allowed / denied / failed を unit test で固定する。
5. 教会ページ access guard を共通化し、`/scripture` の重複 DB query を削除する。
6. unit / integration / E2E auth matrix と必須 CI を通してマージする。

## Progress

- 2026-08-23: Issue、branch、worktree、writer lease を準備。
- 2026-08-23: Next.js 16.3.1 の Server Actions、`headers`、`redirect` 文書を確認。
- 2026-08-23: application から Prisma / Better Auth への直接依存と、5ページの access guard 重複を確認。
- 2026-08-23: 教会作成と password lifecycle を application port + infrastructure adapter に分離し、application 配下の framework / DB import を 0 件にした。
- 2026-08-23: reset / forced-change controller と request ID 付き監査 event を追加し、allowed / denied / validation / failed を unit test で固定。
- 2026-08-23: 教会向け4ページを共通 access guard へ移行し、`/scripture` の重複 church query を削除。
- 2026-08-23: unit coverage（92.58% statements / 85% branches）と integration 73 件が成功。
- 2026-08-23: 全体 check、component 35 件、Playwright E2E 9 件、security check が成功。
- 2026-08-23: application の framework / infrastructure import 禁止を自動検証する境界テストを追加。

## Decisions

- transaction の開始は infrastructure、transaction 内で許可される操作は application port として表現する。
- Server Action は公開 POST 境界として controller を必ず経由する。
- ページ guard は Next.js adapter とし、application の `ChurchAccess` 判定結果だけを扱う。

## Risks

- 認可再確認、session 失効、Better Auth credential 作成の順序を変えるとセキュリティ回帰になる。既存 integration / E2E と新しい controller unit test の双方で固定する。

## Verification

- `pnpm test:unit:coverage`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm check`
- `pnpm security:check`
- `git diff --check`
