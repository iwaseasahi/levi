# Production Compose

このディレクトリは、WebARENA Indigo 4 GB の単一 VPS で Levi を動かすための本番構成です。Caddy だけが 80/443 番ポートを公開し、アプリケーションと PostgreSQL は外部から到達できない `private` ネットワークに置きます。

## ファイル

- `compose.yaml`: Caddy、Levi、PostgreSQL の実行定義
- `Caddyfile`: TLS 自動取得、リバースプロキシ、セキュリティヘッダー
- `production.env.example`: シークレットを含まない設定例

## 設定検証

Docker が動作する開発環境で次を実行します。この操作はコンテナを起動しません。

```bash
pnpm production:config:check
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
