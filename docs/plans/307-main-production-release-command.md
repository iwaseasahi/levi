# mainを安全に固定する2コマンドproduction release

## Issue

- Issue: #307
- Branch: `codex/issue-307`
- Base commit: `b4b424306f3afec7145e926e563c52833fba341f`

## Outcome

Operatorがcommit SHAやimage digestを転記せず、現在の`origin/main`を準備開始時に
固定したproduction releaseを2コマンドで準備・適用できる。

## Context

- `scripts/run-authorized-production-deploy.sh`は、既存authorization artifactから
  exact releaseを安全にVPSへ渡す。
- `.github/workflows/publish-production-images.yml`と
  `.github/workflows/deploy-production.yml`は手入力されたexact値を検証する。
- `docs/operations/manual-production-deploy.md`に現在の8段階手順がある。

## Constraints

- `main`は準備開始時に一度だけ解決し、その40文字SHAを最後まで変更しない。
- CI、immutable digest、repository ownerのIssue承認、`production` Environment承認、
  日曜追加承認、operator MacからのSSH適用を維持する。
- このIssueではproduction deployを実行しない。

## Non-goals

- mergeやpushからの自動deploy。
- production secret、host権限、DB schemaの変更。
- 手動代替（break-glass）経路の削除。

## Plan

1. [x] publish workflowへrelease candidate artifactと追跡可能なrun名を追加する。
2. [x] exact owner approvalの共通validatorとworkflow検証を追加する。
3. [x] `prepare ISSUE_NUMBER`と`deploy PUBLISH_RUN_ID`のoperator commandを実装する。
4. [x] configuration regression testとrunbookを更新する。
5. [x] canonical checksとGitHub CIを通し、PRをmergeする。

## Progress

- 2026-08-26 12:00 JST — Issue #307を作成し、既存workflow、host entrypoint、
  governance、runbookを確認した。
- 2026-08-26 12:10 JST — 2つのoperator command、candidate artifact、exact owner
  approval validator、workflow追跡、runbookを実装した。candidate request自体が承認に
  誤認されないよう、通常承認本文をexact 4行（Sunday併記時は5行）へ制限した。
- 2026-08-26 12:15 JST — CI相当のsynthetic HTTPS設定で`pnpm check`が成功した。
  unit 52 files/264 tests、component 15 files/53 tests、production buildを含む。
- 2026-08-26 12:25 JST — PR #308のQuality、Database、E2E、Securityがすべて
  成功した。計画の完了記録を最終headへ反映し、同じrequired CIを再確認する。

## Decisions

- 2026-08-26 — `origin/main`を準備開始時に固定し、release candidate artifactへ保存する。
  - Reason: operator入力を減らしながら、準備後にmainが更新される競合を防げる。
  - Alternatives: deploy時点のmainを再解決する方式は承認対象が変わり得るため不採用。
- 2026-08-26 — 人間のIssue承認とGitHub Environment承認は残す。
  - Reason: production approval boundaryであり、簡略化の対象ではない。

## Risks and mitigations

- Risk: workflow dispatch後に別runを誤って選ぶ。
  - Mitigation: exact run-name、dispatch時刻、workflow path、event、branch、artifact内run IDを重ねて検証する。
- Risk: approvalが別releaseへ流用される。
  - Mitigation: owner associationとcommit・両digestの完全一致行をworkflowとlocal commandの両方で検証する。

## Verification

- [x] `pnpm deployment:config:check`
- [x] `pnpm check`（CI相当のsynthetic HTTPS環境変数）
- [x] `git diff --check`
- [ ] Required CI: Quality, Database, E2E, Security
- [ ] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: investigation and Issue creation.
- Remaining: implementation, tests, documentation, PR, CI, merge.
- Blocker: none.
- Resume with: add release candidate artifact to the publish workflow.

## Result

`origin/main`を準備開始時にexact SHAへ固定する2コマンドreleaseフローを実装した。
operatorはIssue番号とpublish run IDだけを入力し、commit・digestの転記は不要になった。
exact owner approval、protected Environment、Sunday approval、operator Mac経由のVPS
entrypointは維持され、candidate request自体を承認と誤認しない回帰検査も追加した。
