# WebARENA Indigo ホスト初期構築・堅牢化手順

## 目的と前提

この手順は、WebARENA Indigo（東京、Ubuntu 24.04、4 GB）1台に Levi のアプリケーションと PostgreSQL を配置するためのものです。契約、VPS 作成、課金、DNS 変更、本番シークレット投入は人間の承認後にだけ実行します。

単一 VPS・単一ディスク構成のため、VPS、ディスク、リージョンを失う障害からは復旧できません。ホスト内バックアップは誤操作や論理障害向けであり、災害対策ではありません。

## 1. VPS 作成時

- Ubuntu 24.04、東京リージョン、4 GB プランを選ぶ。
- 管理用 SSH 公開鍵だけを登録する。パスワードログインは使わない。
- WebARENA firewall は TCP 22、80、443 と UDP 443 の受信だけを許可する。
- 22 番ポートの送信元は、運用端末の現在の public IPv4 を `/32` で指定する。固定 IP でない場合は、変更のたびに WebARENA 管理画面から更新する。
- PostgreSQL の 5432 番ポートは公開しない。
- WebARENA firewall は IPv6 rule に対応しないため、host 側の UFW を `IPV6=yes` で有効にする。初回 DNS には AAAA record を追加しない。

## 2. SSH と管理ユーザー

初回接続後、別のターミナルで新しい接続を確認するまで現在の SSH セッションを閉じません。

```bash
sudo adduser levi-system-operator
sudo usermod -aG sudo,users levi-system-operator
sudo install -d -m 700 -o levi-system-operator -g levi-system-operator /home/levi-system-operator/.ssh
sudo cp /home/ubuntu/.ssh/authorized_keys /home/levi-system-operator/.ssh/authorized_keys
sudo chown levi-system-operator:levi-system-operator /home/levi-system-operator/.ssh/authorized_keys
sudo chmod 600 /home/levi-system-operator/.ssh/authorized_keys
```

`levi-system-operator` で公開鍵ログインと `sudo whoami` が成功することを確認してから、次を `/etc/ssh/sshd_config.d/90-levi-hardening.conf` に置きます。初期 `ubuntu` account は console recovery のため削除しませんが、SSH login は許可しません。

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowUsers levi-system-operator
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
sudo apt install -y ca-certificates curl git jq openssl unattended-upgrades ufw
sudo dpkg-reconfigure -plow unattended-upgrades
grep '^IPV6=yes$' /etc/default/ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 443/udp comment 'HTTP/3'
sudo ufw logging low
sudo ufw enable
sudo ufw status verbose
```

OS 更新後に再起動が必要かを確認し、日曜の利用時間外に再起動します。

## 4. Docker と配置ディレクトリ

Docker Engine と Compose plugin は Docker 公式の Ubuntu 向け APT repository から導入し、バージョンを記録します。convenience script は production で使用しません。`levi-system-operator` は Docker グループへ追加しません。Docker ソケットは root 相当の権限を持つため、デプロイ時だけ `sudo docker compose` を使います。

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
