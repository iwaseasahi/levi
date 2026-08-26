# Production deployフローと手動代替手順を一つのrunbookで追跡できるようにする

## Issue

- Issue: #305
- Branch: `codex/issue-305`
- Base commit: `9a6a2d52810f5900e20d27666f0437921a957d9a`

## Outcome

Leviのproduction deployについて、準備、immutable image公開、GitHub承認、operator Macからの適用、VPS内の処理、完了確認を順番に実行できる。GitHub authorization artifactが利用できない場合も、通常経路と同じ安全条件を維持した手動代替手順を選べる。

## Context

- `docs/operations/manual-production-deploy.md`: 現在のproduction deploy runbook
- `.github/workflows/publish-production-images.yml`: immutable image公開
- `.github/workflows/deploy-production.yml`: exact artifactの検証とEnvironment承認
- `scripts/run-authorized-production-deploy.sh`: operator Mac側のauthorization検証とSSH適用
- `scripts/production-deploy-entrypoint.sh`: VPS側の限定sudo entrypoint
- `scripts/production-deploy.sh`: backup、migration、起動、記録
- `deploy/production/production.env.example`: production runtime設定の非secret例

## Constraints

- secret実値をrepository、Issue、コマンド例、ログへ含めない。
- production deploy、migration、日曜deployは既存の人間承認境界を維持する。
- 手動代替を通常経路の安易な迂回手段にしない。
- migrationを逆向きに戻す手順や、直接の`docker compose up`をdeploy手順として追加しない。

## Non-goals

- productionへの実deploy
- secretの作成、変更、ローテーション
- backup/restore runbook自体の変更
- GitHub Actionsやホストスクリプトの挙動変更

## Plan

1. [x] 現在のworkflow、operator runner、host entrypoint、deploy script、environment境界を照合する。
2. [x] runbookへ全体像、通常deploy、手動代替、確認・記録・復旧判断を追記する。
3. [x] 文書と実装契約の整合性、format、deployment configを検証する。

## Progress

- 2026-08-26 11:30 JST — Issue #305を作成し、deploy関連workflow・script・runbookと`/etc/levi/production.env`境界を確認した。
- 2026-08-26 11:43 JST — runbookを日本語で再構成し、標準8段階、VPS内部処理、手動代替条件、失敗時判断、関連runbookを一つの流れに統合した。
- 2026-08-26 11:44 JST — synthetic CI設定で`pnpm check`が成功した。52 unit files・264 tests、15 component files・53 tests、production buildを含む。

## Decisions

- 2026-08-26 — 通常deployは引き続きGitHub authorization artifact経由とし、手動deployはartifact経路が利用不能な場合の例外手順として文書化する。
  - Reason: 手動操作でもhost entrypointを利用すれば、入力形式、main ancestry、image revision、backup、forward migration、readiness、deploy履歴を維持できる。
  - Alternatives: `docker compose up`の直接実行はbackup・migration・記録を抜かせるため採用しない。

## Risks and mitigations

- Risk: 手動手順がGitHub Environment承認の恒常的な迂回に使われる。
  - Mitigation: 使用条件、追加のIssue記録、ownerによるexact artifact確認を必須化し、通常経路復旧後の追認記録を要求する。
- Risk: shell例からsecretが履歴へ残る。
  - Mitigation: deploy引数には非secretのcommit、digest、Issue URLだけを使用し、production env値をコマンドへ展開しない。

## Verification

- [x] `mise exec -- pnpm format:check`
- [x] `mise exec -- pnpm deployment:config:check`
- [x] synthetic CI environmentで`mise exec -- pnpm check`
- [x] runbook内のworkflow名、引数数、パス、出力先を実装と照合
- [x] Final diff reviewed for scope, secrets, migrations, and unsafe defaults

## Handoff or blockers

- Completed: 現行フロー調査、runbook更新、local verification
- Remaining: commit、PR、CI、merge
- Blocker: none
- Resume with: diffをcommitし、PRを作成する

## Result

`docs/operations/manual-production-deploy.md`へproduction env境界、標準deploy、
GitHubとVPSの責任分離、artifact障害時の手動代替、失敗時のforward recovery判断を
統合した。production環境やsecretには変更を加えていない。
