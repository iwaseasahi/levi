# WebARENA Indigo ホスト初期構築・堅牢化手順

## 目的と前提

この手順は、WebARENA Indigo（東京、Ubuntu 24.04、4 GB）1台に Levi のアプリケーションと PostgreSQL を配置するためのものです。契約、VPS 作成、課金、DNS 変更、本番シークレット投入は人間の承認後にだけ実行します。

単一 VPS・単一ディスク構成のため、VPS、ディスク、リージョンを失う障害からは復旧できません。ホスト内バックアップは誤操作や論理障害向けであり、災害対策ではありません。

## 1. VPS 作成時

- Ubuntu 24.04、東京リージョン、4 GB プランを選ぶ。
- 管理用 SSH 公開鍵だけを登録する。パスワードログインは使わない。
- セキュリティグループは TCP 22、80、443 と UDP 443 の受信だけを許可する。
- 22 番ポートの送信元は、運用上可能なら管理者の固定 IP に限定する。
- PostgreSQL の 5432 番ポートは公開しない。

## 2. SSH と管理ユーザー

初回接続後、別のターミナルで新しい接続を確認するまで現在の SSH セッションを閉じません。

```bash
sudo adduser levi-operator
sudo usermod -aG sudo levi-operator
sudo install -d -m 700 -o levi-operator -g levi-operator /home/levi-operator/.ssh
sudo cp /root/.ssh/authorized_keys /home/levi-operator/.ssh/authorized_keys
sudo chown levi-operator:levi-operator /home/levi-operator/.ssh/authorized_keys
sudo chmod 600 /home/levi-operator/.ssh/authorized_keys
```

`levi-operator` で公開鍵ログインできたことを確認してから、次を `/etc/ssh/sshd_config.d/90-levi-hardening.conf` に置きます。

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowUsers levi-operator
```

構文を検証してから反映します。

```bash
sudo sshd -t
sudo systemctl reload ssh
```

## 3. OS 更新とファイアウォール

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl unattended-upgrades ufw
sudo dpkg-reconfigure -plow unattended-upgrades
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

OS 更新後に再起動が必要かを確認し、日曜の利用時間外に再起動します。

## 4. Docker と配置ディレクトリ

Docker Engine と Compose plugin は Docker 公式の Ubuntu 向け手順で導入し、バージョンを記録します。`levi-operator` は Docker グループへ追加しません。Docker ソケットは root 相当の権限を持つため、デプロイ時だけ `sudo docker compose` を使います。

```bash
sudo install -d -m 755 -o root -g root /opt/levi
sudo install -d -m 700 -o root -g root /etc/levi
sudo install -m 600 -o root -g root /dev/null /etc/levi/production.env
```

`production.env.example` を参考に `/etc/levi/production.env` を作成します。実値をリポジトリ、Issue、ログ、シェル履歴へ記録しません。アプリケーション用 DB ユーザーにはアプリケーションスキーマだけの権限を与えます。

## 5. 配置前の確認

```bash
sudo stat -c '%a %U:%G %n' /etc/levi/production.env
sudo docker compose \
  --env-file /etc/levi/production.env \
  -f /opt/levi/deploy/production/compose.yaml \
  config --quiet
sudo ss -lntup
```

期待値は、環境ファイルが `600 root:root`、外部待受が SSH、HTTP、HTTPS だけであることです。デプロイ後も PostgreSQL は Compose の `private` 内部ネットワークにだけ接続し、ホストへポートを公開しません。

## 6. 定期確認

- 毎週、ディスク使用率、コンテナ再起動回数、`unattended-upgrades` の結果を確認する。
- 毎月、Ubuntu、Docker、Caddy、Node.js、PostgreSQL の更新有無を確認する。
- イメージの digest 更新は PR と CI を通し、バックアップ取得後に適用する。
- 日曜の利用直前には変更を入れず、死活・準備完了チェックだけを行う。
