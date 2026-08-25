# Production Compose

このディレクトリは、WebARENA Indigo 4 GB の単一 VPS で Levi を動かすための本番構成です。Caddy だけが 80/443 番ポートを公開し、アプリケーションと PostgreSQL は外部から到達できない `private` ネットワークに置きます。

## ファイル

- `compose.yaml`: Caddy、Levi、PostgreSQL の実行定義
- `../../Dockerfile.production`: Levi applicationのproduction image定義
- `../../Dockerfile.migrate.production`: Prisma migrationを既定動作とし、承認済みdump向けの既存Bible import CLIも同梱するproduction image定義
- `Caddyfile`: TLS 自動取得、リバースプロキシ、セキュリティヘッダー
- `domain.json`: 選定済みの公開domain、canonical origin、DNS providerの非secret設定
- `production.env.example`: シークレットを含まない設定例
- `backup.env.example`: root 管理のバックアップ設定例
- `systemd/`: hourly 48時間、毎週月曜日・30日保持のweekly暗号化バックアップと監視timer
- `monitoring.env.example`: readiness、DB、容量、5xx、backup age の監視設定例
- `journald-levi.conf`: 圧縮、200 MB、14日間の journal retention

## 設定検証

Docker が動作する開発環境で次を実行します。この操作はコンテナを起動しません。

```bash
mise exec -- pnpm production:domain:check
mise exec -- pnpm production:config:check
```

前者はdomain未取得の状態でもnetworkへ接続せず、production originとCaddyの`www` redirectが選定内容からずれていないことを確認します。取得・DNS設定・TLS発行後の外部検証は、承認済みIPv4をrepositoryへ保存せずに次で実行します。

```bash
LEVI_EXPECTED_IPV4='<approved WebARENA IPv4>' \
  mise exec -- pnpm production:domain:verify
```

アプリイメージをビルドし、使い捨ての PostgreSQL とともに起動して、非 root 実行、読み取り専用 root filesystem、準備完了 endpoint を確認するには次を実行します。終了時にはコンテナ、ネットワーク、volume、ローカルイメージを削除します。

```bash
pnpm production:rehearse
```

本番では環境ファイルをリポジトリ外の `/etc/levi/production.env` に `600 root:root` で保存し、常に明示的に渡します。

```bash
sudo docker compose \
  --env-file /etc/levi/production.env \
  -f /opt/levi/deploy/production/compose.yaml \
  config --quiet
```

`LEVI_IMAGE` を本番用の不変な参照（`registry/repository@sha256:...`）に設定します。既定の `levi-production:local` はローカルビルド確認専用で、本番では使用しません。

## 起動前ゲート

実際の起動には、VPS 契約・課金、本番シークレット、ドメイン、DNS 変更が必要です。これらは Issue #88 と #89 の人間承認ゲートを通過するまで実行しません。起動、DB migration、初回データ投入、切り戻しは後続 Issue の runbook に従います。

ホスト側の SSH、UFW、更新設定は [WebARENA Indigo ホスト初期構築・堅牢化手順](../../docs/operations/webarena-host-hardening.md) を参照してください。
バックアップ、隔離復元、全セッション失効、承認済み切替は [Backup, restore, and logical recovery](../../docs/operations/backup-restore.md) を参照してください。
exact commit／digestの公開・手動デプロイは [Manual production image publication and deployment](../../docs/operations/manual-production-deploy.md)、監視とincident routingは [Production monitoring, logs, and incident routing](../../docs/operations/production-monitoring.md) を参照してください。
XServer Domainでの購入後のDNS・TLS切替は [XServer Domain DNS and TLS cutover](../../docs/operations/xserver-domain-cutover.md) を参照してください。
