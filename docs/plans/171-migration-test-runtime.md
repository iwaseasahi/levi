# Bible import exact判定とtest runtime bootstrapを共通化する

## Issue

- Issue: #171
- Parent: #158
- Branch: `codex/issue-171`
- Base commit: `2d6cc07`

## Outcome

Bible importのexact判定を単一の純粋関数へ集約してreport format v2の契約をgolden testで固定する。integration/E2E runnerはDB bootstrapと子プロセス失敗処理を共有しつつ、固有environmentと最終コマンドを各runnerに明示する。

## Context

- `src/migration/ginmaku-bible-import.ts`は656行で、同一のcount/fingerprint/sample比較がreconcile、dry-run、importの3経路に重複する。
- `scripts/run-integration-tests.ts`と`scripts/run-e2e-tests.ts`はlocal DB起動、Prisma generate/migrate、spawn失敗処理が重複する。
- migration integration/rehearsalはreport v2、空本文、verse 0、冪等性、rollback、restore reconciliationを既に検証する。

## Constraints

- 実dump、production dataを使わない。
- report format v2、空本文、verse 0、fingerprint、CLI、transaction、merged migrationを変更しない。
- integration/E2E固有envと実行順をrunnerから判読可能に保つ。

## Non-goals

- parser/validator/reconciler/writerの全面的なファイル分割。
- migration、schema、dump、report互換性の変更。
- test retryや実行順の意味変更。

## Plan

1. [x] import経路、migration証跡、test runner重複を調査しrisk-benefitを評価する。
2. [x] exact/sample判定を純粋関数へ移し、全比較軸を固定するgolden unit testを追加する。
3. [x] process executionとDB bootstrapをrunner helperへ集約し、固有env/最終test commandを各runnerに残す。
4. [x] migration integration/rehearsal、integration/E2E runner、canonical checksを検証する。
5. [ ] exact-head required CI通過後にPRをmergeする。

## Progress

- 2026-08-23 16:39 JST — Started; #171/#158、migration evidence policy、656行import、2 runnerを確認。
- 2026-08-23 16:42 JST — count 3軸、fingerprint 5軸のexactnessを純粋関数へ集約。golden unit 9 passed。
- 2026-08-23 16:43 JST — process失敗処理とlocal DB/Prisma bootstrapを共通化。固有envとintegration/Playwrightコマンドは各runnerに保持。
- 2026-08-23 16:45 JST — integration 75（import/rehearsal含む）、E2E 13、unit 227、component 39、build/schema/securityを通過。

## Decisions

- 2026-08-23 — import本体の全面分割は行わず、exact判定のみを抽出する。
  - Reason: 現在のmigrationは完了済みで専用integration/rehearsalを持つ。parser/writerの配置変更はobservableな便益が小さく、rollback証跡を再検証する変更面だけを増やす。一方、3箇所のexact条件は項目追加時のdriftリスクがあり、純粋関数化の便益が明確。
  - Reconsider when: report v3、別source format、追加translation、import再利用、またはwriter変更が必要になった時。
- 2026-08-23 — runner共通化はprocess/DB bootstrapだけに限定する。
  - Reason: environmentのprefix/defaultと最終test commandは各runnerの契約なので、共通設定へ隠さない。

## Risks and mitigations

- Risk: exact条件から既存比較軸が脱落する。
  - Mitigation: countsと5 fingerprintの一致・各不一致をtable-driven golden testで固定する。
- Risk: runner共通化でCI/local順序やenvironmentが変わる。
  - Mitigation: helperは同期実行順を維持し、両canonical runnerを実行する。
- Risk: migration証跡を意図せず変更する。
  - Mitigation: synthetic fixtureだけでimport integrationとrehearsalを通し、schema/migration diffなしを確認する。

## Verification

- [x] exactness golden unit test — 9 passed
- [x] `pnpm test:integration` — 75 passed、import 4/rehearsal 1を含む
- [x] `pnpm test:e2e` — 13 passed、共通runner経由
- [x] `pnpm db:schema:check` — schema/migration/datasource diffなし
- [x] `pnpm check` — unit 227、component 39、production build
- [x] `pnpm security:check` — vulnerabilities 0、approved licenses 314
- [x] `git diff --check`
- [ ] required CI

## Handoff or blockers

- Completed: risk-benefit評価、exactness/helper実装、local canonical verification。
- Remaining: commit、PR、required CI、merge。
- Blocker: なし。
- Resume with: commitしてPRを作成し、exact-head required CIを確認する。

## Result

実装とローカル検証は完了。required CIとmerge待ち。Serializable競合の別件は #184 に分離した。
