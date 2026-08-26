# Production deploy runbook

## 目的と用語

Leviのproduction deployは、`main`へmergeしただけでは始まりません。通常経路も
人間が開始・承認・適用する手動フローです。GitHub Actionsはimmutable imageの
作成とrelease authorizationの検証を行いますが、production VPSへSSH接続しません。

このrunbookでは次の2つを区別します。

- **通常deploy**: GitHubの`production` Environmentで承認し、一日保持の
  authorization artifactをoperator Macで検証してVPSへ適用する標準経路。
- **手動代替deploy**: authorization workflowまたはartifact配布が利用不能で、
  待つ方が運用リスクを高める場合に限り、operatorが同じexact releaseをVPSの
  制限付きentrypointへ直接渡すbreak-glass経路。

どちらもexact commit、成功済みCI、immutable image digest、Issue上の即時承認、
deploy前backup、forward-only migration、readiness確認を省略しません。

## 全体構成

```text
main上のexact commit
  ├─ CI: Quality / Database / E2E / Security
  └─ Publish production images
       ├─ application image @ sha256 digest
       └─ migration image   @ sha256 digest
                    │
                    ▼
release Issueのexact artifact承認
                    │
                    ▼
Authorize production deploy
  ├─ commit・CI・digest・Issue commentを検証
  ├─ production Environmentで人間が承認
  └─ 1日保持のauthorization artifactを作成
                    │
                    ▼
allowlist済みoperator Mac
  pnpm production:deploy:authorized -- RUN_ID
                    │ pinned SSH alias
                    ▼
VPS /usr/local/sbin/levi-production-deploy
  ├─ origin/main ancestryと入力を再検証
  ├─ /opt/leviをexact commitへ切替
  ├─ image revision labelを検証
  ├─ 暗号化operational backup
  ├─ forward-only Prisma migration
  ├─ PostgreSQL・app・Caddyを起動してreadiness待機
  └─ /var/lib/levi-deployへrelease記録
```

## 変更してはいけない安全境界

releaseには以下がすべて必要です。

1. `main`へmerge済みのexact 40-character commit。
2. 同じcommitに対する`Quality`、`Database`、`E2E`、`Security`の成功。
3. commitのrevision labelを持つapplicationとmigrationのimmutable digest。
4. commit、2つのdigest、migration、backup、利用者影響、実施時刻、
   rollbackまたはforward recoveryを承認するIssue comment。
5. 通常経路ではGitHub `production` Environmentの承認。手動代替では、後述する
   使用条件を満たす明示的なbreak-glass承認と記録。
6. `Asia/Tokyo`の日曜以外での実施、または同じexact releaseへの追加Sunday
   approval。

push、merge、schedule、モデル/API呼び出しから自動deployしません。mutable tag、
CI未成功のcommit、別releaseへの承認、期限切れartifactを流用しません。

日曜承認は宣言されたapplication deployとforward-only migrationだけを許可します。
Bible import、data repair、restore、secret変更、OS/package操作、VPS再起動は別の
human gateです。

## production環境変数

### 作成と保管

productionの実値はGitHub ActionsやGit repositoryへ保存しません。設定項目は
[`../../deploy/production/production.env.example`](../../deploy/production/production.env.example)
を参照し、人間がVPSの`/etc/levi/production.env`へ対話的に入力します。

関連ファイルは次の権限で保管します。

```text
/etc/levi                         700 root:root
/etc/levi/production.env          600 root:root
/etc/levi/backup.env              600 root:root
/etc/levi/monitoring.env          600 root:root
/etc/levi/backup-recipient.crt    644 root:root
```

通常ユーザーから`/etc/levi`内が見えないのは意図した挙動です。値を表示せず確認
します。

```bash
sudo stat -c '%F %a %U:%G %n' \
  /etc/levi/production.env \
  /etc/levi/backup.env \
  /etc/levi/monitoring.env
sudo /opt/levi/scripts/check-production-secrets.sh
```

validatorはplaceholder、URL、credential分離、image digest、Compose展開を検証
します。確認のために`cat`、`env`、`docker compose config`の通常出力を使用して
はいけません。

### deploy時の参照

Composeには常に`--env-file /etc/levi/production.env`を明示します。通常deploy
では、承認された`LEVI_IMAGE`と`LEVI_MIGRATION_IMAGE`だけをhost entrypointから
実行時に上書きします。DB password、Better Auth secret、Basic認証情報をdeploy
ごとに転送しません。

`DATABASE_URL`は最小権限の`levi_app`へ接続し、application containerだけに渡し
ます。`MIGRATION_DATABASE_URL`と`MIGRATION_SHADOW_DATABASE_URL`は`levi_admin`
へ接続し、migration containerだけに渡します。secret変更やDB credential rotation
は通常deployとは別の承認作業です。

## 一度だけ行う準備

### GitHub

repository ownerが次を設定します。

- Environment名を正確に`production`として作成する。
- Levi operatorをrequired reviewerにする。契約プランで可能ならself-reviewを禁止
  する。
- deployment branch/tagを`main`に制限する。
- repository variable `PRODUCTION_BASE_URL`を`https://levi-system.com`にする。

GitHubにproduction SSH private keyは保存しません。旧方式の
`PRODUCTION_SSH_HOST`、`PRODUCTION_SSH_USER`、`PRODUCTION_SSH_PRIVATE_KEY`、
`PRODUCTION_SSH_KNOWN_HOSTS` secretsは使用しません。

`PRODUCTION_BASE_URL`は外部endpointが稼働してから設定します。この変数があると
scheduled production smokeが有効になります。

### operator MacとVPS

operator MacはWebARENA consoleから確認したhost keyをSSH設定へ固定し、alias
`levi-system-production`を使用します。無人の`ssh-keyscan`で信頼を置き換えません。
WebARENA firewallのSSH sourceはoperator Macのpublic IPv4 `/32`だけにします。

VPSではroot所有の`/opt/levi`にrepositoryを配置し、制限付きentrypointを一度だけ
導入します。

```bash
sudo /opt/levi/scripts/install-production-deploy-entrypoint.sh
sudo visudo -cf /etc/sudoers.d/levi-production-deploy
sudo -l
```

sudoersは`levi-system-operator`へ
`/usr/local/sbin/levi-production-deploy`だけをpasswordlessで許可します。`git`、
`env`、`docker`、shell、任意scriptへのpasswordless sudoは許可しません。

entrypointはcommit、application digest、migration digest、通常承認comment URL、
Sunday承認comment URLまたは`none`のexact 5引数だけを受け取ります。

## 通常deploy手順

### 1. releaseを固定する

release Issueを用意し、対象commitが`main`へmerge済みであることを確認します。

```bash
git fetch origin main
COMMIT_SHA='<40-character commit on main>'
git merge-base --is-ancestor "$COMMIT_SHA" origin/main
```

GitHub上で、そのcommitの`Quality`、`Database`、`E2E`、`Security`がすべて成功
していることを確認します。失敗、pending、別commitの成功結果は使用しません。

### 2. immutable imageを公開する

GitHub Actionsの`Publish production images`を手動実行し、`commit_sha`へ対象commit
を指定します。workflowはCIとmain ancestryを再確認し、`linux/amd64`のapplication
imageとmigration imageをGHCRへpushします。

workflow summaryに出た次の2つをrelease Issueへ記録します。

```text
ghcr.io/iwaseasahi/levi@sha256:<64 hexadecimal characters>
ghcr.io/iwaseasahi/levi-migrate@sha256:<64 hexadecimal characters>
```

tag、`latest`、digestを省略したimage名は使用しません。source repositoryはpublicで
imageにDB dump、Bible data、secretを含めないため、VPSはpublic GHCR packageを
credentialなしでpullします。package visibilityや課金条件の変更は別のhuman action
です。

### 3. exact releaseを承認する

repository ownerがrelease Issueへ、少なくとも以下を含む即時承認コメントを投稿
します。

- exact 40-character commit
- application image digest
- migration image digest
- migrationの有無と影響
- 最新backupの状態
- 想定する利用者影響と実施時刻
- rollbackまたはforward-recovery方針
- 実行責任者

### 4. 日曜の場合だけ追加承認する

`Asia/Tokyo`の日曜に実施する場合、repository ownerが「このexact releaseを日曜に
deployしてよいか」へ明示的に回答し、次の独立した行をcommentへ含めます。

```text
Sunday-Deploy: APPROVED
Commit: <40-character commit SHA>
Application-Image: ghcr.io/iwaseasahi/levi@sha256:<64 hexadecimal characters>
Migration-Image: ghcr.io/iwaseasahi/levi-migrate@sha256:<64 hexadecimal characters>
```

通常の即時承認commentと同じcommentでも構いません。日曜以外は
`sunday_approval_comment`を空にし、host entrypointへは`none`を渡します。

日曜は原則としてread-only health checkとincident communicationを優先します。
待つ方が運用リスクを高める場合だけdeployし、利用中なら影響する教会へ事前連絡
します。

### 5. GitHub authorizationを作る

GitHub Actionsの`Authorize production deploy`を手動実行し、以下を入力します。

- `commit_sha`
- `application_image`
- `migration_image`
- `approval_comment`
- `sunday_approval_comment`（日曜だけ）

workflowは入力形式、Issue commentのrepository-owner association、日曜承認のexact
一致、main ancestry、4つのrequired CIを検証します。その後、`production`
Environmentを人間が承認します。

成功すると、現在のrun attemptに結び付いたauthorization artifactが一日だけ保持
されます。workflow全体が成功した`RUN_ID`を控えます。失敗run、superseded attempt、
期限切れartifactは使用しません。

### 6. operator Macから適用する

operator Macのpublic IPv4とSSH接続を確認します。IPが変わった場合はWebARENA
consoleからSSH ruleを新しい`/32`へ変更し、既存sessionを閉じる前に別terminalで
新規接続を確認します。SSHを`0.0.0.0/0`へ開放しません。

```bash
curl -4 https://ifconfig.me
ssh levi-system-production true
mise exec -- pnpm production:deploy:authorized -- RUN_ID
```

最後のコマンドはauthenticated GitHub CLIを使い、run、workflow、attempt、artifact
の全fieldを再検証してから、pinned SSH alias経由でVPS entrypointを実行します。

### 7. VPS内で自動実行される処理

operatorが個別に実行する必要はありません。entrypointと
`scripts/production-deploy.sh`が次の順序で処理します。

1. exact 5引数、曜日、approval URL形式を検証する。
2. `/opt/levi`で`origin/main`をfetchし、commitがancestorであることを確認する。
3. root所有repositoryをexact commitへdetached checkoutする。
4. applicationとmigration imageをpullし、両方のOCI revision labelがcommitと一致
   することを確認する。
5. production Composeを値を表示せず検証する。
6. 新しい暗号化operational backupを取得する。
7. admin identityを持つisolated migration imageでforward-only Prisma migrationを
   実行する。
8. PostgreSQL、application、Caddyを`--wait`付きで起動する。
9. commit、digest、通常承認、Sunday承認、UTC時刻を
   `/var/lib/levi-deploy/history/`へ記録し、`current.env`を更新する。

### 8. 完了を確認して記録する

deployコマンドが成功した後、外部readinessとVPS内の総合healthを確認します。

```bash
curl --fail --silent --show-error https://levi-system.com/api/ready
ssh -t levi-system-production \
  'sudo systemctl start levi-health.service && \
   sudo systemctl show --property=Result --value levi-health.service'
```

期待値はreadiness JSONの`status`が`ready`、systemd service resultが`success`です。
release Issueへ次を記録します。secret、cookie、authorization header、Bible本文は
記録しません。

- image publishとauthorization workflowのrun URL、RUN_ID
- deployed commitと2つのdigest
- host deployの成功時刻（UTCまたはJSTを明記）
- backup、migration、readiness、database、proxy 5xxの結果
- 利用者影響と残作業

## GitHub authorization artifactを使えない場合の手動代替

### 使用してよい条件

通常はauthorization artifact経由を使用します。artifactが失効しただけなら
`Authorize production deploy`を再実行します。入力検証、CI、approval、Environment
reviewのいずれかが失敗した場合も、その原因を直すまで手動代替へ切り替えません。

手動代替を使用できるのは、次をすべて満たす場合だけです。

1. GitHub authorization workflowまたはartifact配布機能に障害がある。
2. 復旧を待つ方が現在のproduction運用リスクを高める。
3. repository ownerが、手動代替であることを明記してexact commit、2つのdigest、
   migration、backup、影響、forward recovery、実施時刻、operatorをIssue上で承認
   している。
4. operatorがcommitのmain ancestry、4つのrequired CI、image digestとrevisionを
   独立して確認できる。
5. 日曜の場合は同じexact releaseへのSunday approvalがある。

GitHub自体へ到達できず、CI結果またはowner approvalを確認できない場合はdeploy
しません。既知の良好なreleaseを動かし続け、incident communicationを優先します。

### 手動適用

手動代替でも`docker compose up`、migration container、`production-deploy.sh`を
個別に直接実行しません。必ずinstalled command-scoped entrypointを使用します。
これによりmain ancestry、入力形式、image revision、backup、migration、readiness、
deploy履歴を通常経路と同じ実装で処理します。

operator Macで、Issueに承認された非secret値だけを設定して実行します。

```bash
COMMIT_SHA='<approved 40-character commit>'
APPLICATION_IMAGE='ghcr.io/iwaseasahi/levi@sha256:<approved digest>'
MIGRATION_IMAGE='ghcr.io/iwaseasahi/levi-migrate@sha256:<approved digest>'
APPROVAL_COMMENT='https://github.com/iwaseasahi/levi/issues/<issue>#issuecomment-<comment>'
SUNDAY_APPROVAL='none' # 日曜はexact Sunday approval comment URLへ置換

ssh -o BatchMode=yes levi-system-production \
  sudo -n /usr/local/sbin/levi-production-deploy \
  "$COMMIT_SHA" \
  "$APPLICATION_IMAGE" \
  "$MIGRATION_IMAGE" \
  "$APPROVAL_COMMENT" \
  "$SUNDAY_APPROVAL"
```

5項目はrelease metadataでありsecretではありません。それでも誤releaseを避ける
ため、実行直前にIssueの値と一文字ずつ照合します。production env値、DB password、
Better Auth secret、Basic認証情報をcommand lineへ渡してはいけません。

host entrypointはapproval URLの形式を検証しますが、手動代替ではGitHub workflow
によるcomment内容・author association・Environment reviewの自動検証がありません。
減少した統制を、repository ownerの明示commentとoperatorの手動照合としてrelease
Issueに記録します。

成功後は通常deployと同じhealth確認を行い、さらに次をIssueへ記録します。

- 手動代替が必要だった障害と、通常経路を待てなかった理由
- 実行したexact 5引数
- 省略しなかったbackup、migration、readinessの結果
- GitHub機能復旧後に確認したCI、approval、Environment設定

通常経路の復旧後、entrypointやsudoersを変更する必要はありません。手動代替の
ためにSSH、UFW、WebARENA firewall、GitHub permissionsを緩和しません。

## 失敗時の判断

### migration前に失敗した場合

新しいapplicationが起動していなければ、現在のreleaseを維持して原因を修正します。
同じartifactを無条件に再実行せず、backupと失敗点を確認します。

### migration後にapplicationが失敗した場合

適用済みmigrationを逆向きに戻しません。

- migrationが以前のapplicationと互換なら、即時承認を取り、以前のapplication
  digestと現在schemaの組み合わせを再deployする。
- 互換でなければtrafficを停止し、新しいcommitによるforward migrationまたは
  application fixを作成・検証・承認する。
- verified data corruptionだけは
  [`backup-restore.md`](backup-restore.md)に従ってrestoreを検討する。restoreは全session
  を失効させる。

incident対応中にprevious image、`levi_rollback_*` database、backup、restore proof、
deploy historyを削除しません。readiness、5xx window、commit/digest、migration、
data-loss estimate、判断者、教会への連絡時刻、最終結果をincident Issueへ記録します。

## 関連runbook

- [Production Compose](../../deploy/production/README.md)
- [WebARENA Indigo host hardening](webarena-host-hardening.md)
- [Backup, restore, and logical recovery](backup-restore.md)
- [Production monitoring, logs, and incident routing](production-monitoring.md)
- [XServer Domain DNS and TLS cutover](xserver-domain-cutover.md)
- [Administration Basic authentication](admin-basic-auth.md)
