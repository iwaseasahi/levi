# 管理画面に教会一覧を追加する

## Issue

- Issue: #353
- Branch: `codex/issue-353`
- Base commit: `b8dd5c55b7fea5189bd1be6653cf6baeea0cc8ca`

## Outcome

管理者は管理画面から登録済み教会と、その教会に紐づく初期利用者の状態を確認できる。

## Context

- `/admin/churches` は現在、教会作成画面へリダイレクトするだけで一覧を持たない。
- この計画の実施時点では1教会につき1利用者だった。Issue #357 で1教会に複数利用者を許可し、`ChurchMembership.userId` の一意性だけを維持する設計へ更新された。
- 管理画面はBasic認証と管理者専用Better Authセッションの二重境界を維持している。

## Constraints

- 一覧にはパスワード、session、認証tokenなどの機密情報を含めない。
- 既存のBasic認証と管理者ログイン境界を維持する。
- 教会・利用者の更新操作を一覧へ追加しない。
- framework外へ渡すデータは画面専用の最小DTOに限定する。

## Non-goals

- 教会の編集・削除
- 1教会への複数利用者登録
- 教会ごとの権限管理

## Plan

1. [x] Issue、governance、data model、既存管理画面とテスト構成を確認する。
2. [x] 安全な教会一覧queryと表示componentを実装する。
3. [x] 管理画面のsidebarとdashboardから一覧へ到達できるようにする。
4. [x] component、integration、E2Eで表示・空状態・認証境界を検証する。
5. [ ] canonical checks、PR、CI、merge、Issue closeを完了する。

## Progress

- 2026-08-28 — Issue #353を作成し、既存route、schema、ADR、管理画面patternを確認した。
- 2026-08-28 — 最小DTOの一覧query、教会・利用者状態の表示、空状態、sidebarとdashboardの導線を実装した。
- 2026-08-28 — component 60件、integration 88件、E2E 18件が通過した。

## Decisions

- 2026-08-28 — Decision: 一覧の主データを`Church`とし、optionalな`ChurchMembership.user`を同時取得する。
  - Reason: 教会がtenantの集約rootであり、利用者未登録状態も一覧で安全に表現できる。
  - Alternatives: `User`起点ではmembershipのない教会を表示できないため不採用。
  - ADR: `docs/architecture/0007-normalized-data-model.md`
- 2026-08-28 — Decision: stable orderは`createdAt ASC, id ASC`とする。
  - Reason: 再読み込みでも順序が安定し、先に登録した教会から確認できる。

## Risks and mitigations

- Risk: 関連modelをそのまま画面へ渡すと認証情報を誤って露出する。
  - Mitigation: name、email、statusだけをselectする専用DTOとする。
- Risk: `/admin/churches/new`で一覧と作成の両方がcurrent表示になる。
  - Mitigation: sidebarは一致する最長pathだけをcurrentにする。

## Verification

- [x] `pnpm test:component` — 60 passed
- [x] `pnpm test:integration` — 88 passed
- [x] `pnpm test:e2e` — 18 passed
- [x] `pnpm check`
- [x] `git diff --check`
- [x] final diff review

## Handoff or blockers

- Blocker: なし。
- Resume with: canonical checkを実行し、PRを作成する。

## Result

教会一覧の専用queryと画面を追加し、管理画面のsidebarとdashboardから到達できるようにした。教会・利用者の状態、利用者未登録、空状態を安全な最小DTOで表示し、component、integration、E2E、canonical checksで検証した。
