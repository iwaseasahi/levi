# Production deploy runbook

## 方針

Leviのproduction deployは、`main`へのmergeやIssue作成だけでは開始されません。
operatorが2つのcommandを実行し、GitHub protected Environmentで人間が承認して
初めてVPSへ適用されます。deploy承認のためのIssueは作りません。承認対象と記録は
GitHub Actions run、exact commit、immutable image digestへ結び付けます。

## 標準手動deployのクイック手順

通常の手動deployでoperatorが実行するのは、次の2コマンドだけです。

```bash
mise exec -- pnpm production:release:prepare
mise exec -- pnpm production:release:deploy -- PUBLISH_RUN_ID
```

1つ目の出力に表示された`PUBLISH_RUN_ID`を2つ目へ指定します。2つ目の実行中に
GitHub ActionsのURLが表示されたら、`production` Environmentを承認します。
Asia/Tokyoの日曜だけは、続いて`production-sunday` Environmentも承認します。

operatorがVPSへ入ってbackup、migration、Compose起動、readiness確認を個別に実行
する必要はありません。これらは2つ目のコマンドから安全な順序で自動実行されます。
Issue作成、commit SHAやimage digestの手入力、VPS上でのdeployコマンド実行も不要です。

```text
operator Mac
  production:release:prepare
        │ origin/mainをexact SHAへ固定、CIを確認
        ▼
Publish production images
  ├─ application @ sha256
  ├─ migration   @ sha256
  └─ 1日保持のcandidate artifact
        │ PUBLISH_RUN_ID
        ▼
operator Mac
  production:release:deploy -- PUBLISH_RUN_ID
        ▼
Authorize production deploy
  ├─ candidate・main ancestry・4つのCIを再検証
  ├─ production Environment承認
  ├─ 日曜だけproduction-sunday Environment追加承認
  └─ 1日保持のauthorization artifact
        ▼
allowlist済みoperator Mac → pinned SSH alias → VPS entrypoint
        ├─ digestとOCI revisionを検証
        ├─ 暗号化backup
        ├─ forward-only migration
        ├─ app・database・proxy readiness
        └─ Actions run URLをdeploy historyへ記録
```

GitHub Actions runnerはproduction VPSへSSHしません。WebARENA firewallのSSH sourceは
operator Macのpublic IPv4 `/32`だけに維持します。

## 安全境界

releaseには次がすべて必要です。

1. `main`へmerge済みのexact 40-character commit
2. 同じcommitの`Quality`、`Database`、`E2E`、`Security`成功
3. commitのOCI revision labelを持つapplication・migrationのimmutable digest
4. protected `production` Environmentの人間による承認
5. Asia/Tokyoの日曜はprotected `production-sunday` Environmentの追加承認
6. deploy直前の暗号化backupとforward-only migration

candidateとauthorization artifactは1日で失効します。mutable tag、別runの値、失効済み
artifact、未承認runを流用しません。日曜追加承認はapplication deployと宣言済みmigration
だけを許可し、Bible import、restore、secret変更、OS操作、再起動には適用しません。

## 一度だけ行うGitHub設定

repository ownerが次を設定します。

- `production` Environment
  - required reviewerにLevi operatorを指定
  - deployment branchを`main`に制限
- `production-sunday` Environment
  - required reviewerにLevi operatorを指定
  - deployment branchを`main`に制限
  - 日曜の追加承認専用であることを説明へ明記
- repository variable `PRODUCTION_BASE_URL=https://levi-system.com`

利用プランで可能ならself-reviewを禁止します。GitHubへproduction SSH private keyは
保存しません。Environment作成・reviewer変更はrepositoryの権限変更なので、実施前に
人間の明示承認を得ます。

## production環境変数

productionの実値はrepositoryやGitHub Actionsへ保存しません。人間がVPS上の
`/etc/levi/production.env`へ対話的に入力し、`600 root:root`で保管します。
`/etc/levi`は`700 root:root`です。

```bash
sudo stat -c '%F %a %U:%G %n' \
  /etc/levi/production.env \
  /etc/levi/backup.env \
  /etc/levi/monitoring.env
sudo /opt/levi/scripts/check-production-secrets.sh
```

通常ユーザーからファイルが見えないのは意図した動作です。確認に`cat`、`env`、値を
表示する`docker compose config`を使いません。deployはDB password、Better Auth
secret、Basic認証情報を転送せず、承認済みの2つのimage digestだけを実行時に上書き
します。

## 一度だけ行うVPS設定

root所有の`/opt/levi`へrepositoryを配置し、制限付きentrypointを導入します。

```bash
sudo /opt/levi/scripts/install-production-deploy-entrypoint.sh
sudo visudo -cf /etc/sudoers.d/levi-production-deploy
sudo -l
```

sudoersは`levi-system-operator`へ
`/usr/local/sbin/levi-production-deploy`だけをpasswordlessで許可します。entrypointは
commit、2つのdigest、authorization Actions run URL、Sunday authorization run URL
または`none`のexact 5引数だけを受け取ります。`git`、`docker`、shellへの包括的な
passwordless sudoを許可しません。

## 標準手動deploy（実行するのは2コマンドだけ）

### 1. 現在のmainからcandidateを準備する

```bash
mise exec -- pnpm production:release:prepare
```

このcommandは`origin/main`を一度だけexact SHAへ固定し、4つのCIを確認し、immutable
imageを公開してcandidate artifactを検証します。出力されたcommit、application、
migration、candidate Actions URLを確認し、`PUBLISH_RUN_ID`を控えます。準備後にmainが
進んでもcandidateは変化しません。

### 2. authorizationを承認して適用する

実施前にmigration、backup状態、利用者影響、時刻、forward recoveryを確認します。
通常のdeploy操作として実行するコマンドは、次の1つだけです。

```bash
mise exec -- pnpm production:release:deploy -- PUBLISH_RUN_ID
```

回線変更後やSSH接続エラーの調査時だけ、`curl -4 https://ifconfig.me`と
`ssh levi-system-production true`を診断として使用します。毎回の標準deploy手順には
含めません。

commandはcandidateを再検証して`Authorize production deploy`を起動します。表示された
Actions URLを開き、exact commitと両digestを確認して`production` Environmentを承認
します。Asia/Tokyoの日曜は、通常承認後に`production-sunday` Environmentの追加承認
が必要です。どちらかを拒否または放置した場合、VPSへ接続しません。

authorization成功後、commandは1日保持artifactを検証し、allowlist済みoperator Mac
からpinned SSH alias経由で制限付きentrypointを実行します。

### 中断後の再開（例外時のみ）

Environment承認後にoperator commandだけが中断した場合は、authorization run IDで
同じartifactを再検証して適用できます。

```bash
mise exec -- pnpm production:deploy:authorized -- AUTHORIZATION_RUN_ID
```

この再開コマンドは標準の2コマンドへ追加して毎回実行するものではありません。
artifactが失効した場合は`production:release:deploy -- PUBLISH_RUN_ID`をやり直して
新しいEnvironment reviewを受けます。

## VPS内で自動実行される処理

1. exact 5引数、曜日、Actions run URL形式を検証
2. `/opt/levi`でcommitの`origin/main` ancestryを確認しdetached checkout
3. imageをpullしOCI revision labelとcommitの一致を確認
4. production Composeを値を表示せず検証
5. 暗号化operational backupを取得
6. isolated migration imageでforward-only Prisma migration
7. PostgreSQL、application、Caddyを`--wait`付きで起動
8. commit、digest、authorization run URL、UTC時刻を
   `/var/lib/levi-deploy/history/`へ記録

## 完了確認

```bash
curl --fail --silent --show-error https://levi-system.com/api/ready
ssh -t levi-system-production \
  'sudo systemctl start levi-health.service && \
   sudo systemctl show --property=Result --value levi-health.service'
```

readinessの`status=ready`、health serviceの`success`を確認します。deploy承認の監査証跡
はauthorization workflowのrun URLとartifactです。障害や利用者影響があった場合だけ
incident Issueを作成し、secret、cookie、authorization header、Bible本文は記録しません。

## 手動deployと障害時の扱い

通常経路自体が手動開始です。Issueを使う別のbreak-glass deployは設けません。
GitHub Environment review、CI確認、candidate/authorization artifactのいずれかを利用
できない場合はfail closedとし、既知の良好なreleaseを維持します。障害復旧を待てない
場合でも、承認なしの`docker compose up`やmigration直接実行へ切り替えません。

authorization workflowは成功しておりoperator側だけが中断した場合に限り、前節の
`production:deploy:authorized`を使います。production障害はincident Issueへ記録し、
GitHub機能が復旧してから通常経路でforward fixをdeployします。

## migration後に失敗した場合

適用済みmigrationを逆向きに戻しません。以前のapplicationと互換なら承認済みの
forward recoveryを実施し、互換でなければtrafficを止めてapplication fixまたは追加
migrationを作成します。verified data corruptionだけは
[`backup-restore.md`](backup-restore.md)に従ってrestoreを検討します。

## 関連runbook

- [Production Compose](../../deploy/production/README.md)
- [WebARENA Indigo host hardening](webarena-host-hardening.md)
- [Backup, restore, and logical recovery](backup-restore.md)
- [Production monitoring](production-monitoring.md)
- [Administration Basic authentication](admin-basic-auth.md)
