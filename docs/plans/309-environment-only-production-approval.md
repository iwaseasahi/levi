# Issue #309: Issue不要のEnvironment承認production deploy

## Goal

production deploy承認をIssue commentからGitHub protected Environment reviewへ一本化し、
通常日と日曜の追加承認をexact candidate Actions runへ結び付ける。

## Scope

- prepare commandを引数なしにする
- candidate artifactからIssue番号を除く
- authorization workflowがcandidate artifactからexact値を解決する
- `production`と`production-sunday`の段階的Environment gateを追加する
- authorization Actions run URLをhost監査記録へ渡す
- Issue承認validatorを削除する
- configuration testとrunbookを更新する

## Safety

- workflowはproductionへSSHしない
- candidateとauthorization artifactは1日保持
- main ancestry、required CI、digest形式をworkflowとoperator側で再検証する
- 日曜は2つのEnvironment gateを通らない限りauthorization artifactを作らない
- GitHub Environment設定とVPS entrypoint更新はmerge後に別の明示承認を得る

## Verification

- `mise exec -- pnpm check`
- GitHub CI: Quality / Database / E2E / Security
