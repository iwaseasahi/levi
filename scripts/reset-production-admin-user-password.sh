#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly repository="${LEVI_DEPLOY_REPOSITORY:-/opt/levi}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly environment_file="${LEVI_ENV_FILE:-/etc/levi/production.env}"
readonly lock_directory="/run/levi-admin-password-recovery.lock"

if [[ "$EUID" -ne 0 ]]; then
  echo "Production administrator password recovery must run as root." >&2
  exit 2
fi
if [[ "$#" -ne 0 || ! -t 0 || ! -t 1 ]]; then
  echo "Run this command without arguments from an interactive terminal." >&2
  exit 2
fi
if [[ ! -f "$environment_file" || ! -f "$compose_file" ]]; then
  echo "Production configuration is unavailable." >&2
  exit 1
fi
if ! mkdir "$lock_directory" 2>/dev/null; then
  echo "Another administrator password recovery is already running." >&2
  exit 1
fi
cleanup() {
  rmdir "$lock_directory" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

read -r -p "管理者ログインID: " login_id
login_id="${login_id,,}"
if [[ ! "$login_id" =~ ^[a-z0-9._@-]{3,100}$ ]]; then
  echo "ログインIDは3〜100文字の半角英数字と . _ @ - で入力してください。" >&2
  exit 2
fi

read -r -s -p "一時パスワードハッシュ: " password_hash_input
printf '\n'
password_hash="${password_hash_input#ADMIN_BASIC_AUTH_PASSWORD_HASH=}"
unset password_hash_input
if [[ ! "$password_hash" =~ ^[a-f0-9]{32}:[a-f0-9]{128}$ ]]; then
  echo "pnpm admin:hash-password が出力したハッシュを入力してください。" >&2
  exit 2
fi

compose() {
  docker compose --env-file "$environment_file" --file "$compose_file" "$@"
}

compose up --detach --wait postgres >/dev/null
readonly postgres_container="$(compose ps --quiet postgres)"
if [[ -z "$postgres_container" ]]; then
  echo "Production PostgreSQL container is unavailable." >&2
  exit 1
fi

readonly target_count="$(
  docker exec "$postgres_container" sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc "$1"' \
    sh "SELECT count(*) FROM admin_users WHERE login_id = '${login_id}' AND status IN ('INVITED', 'ACTIVE');"
)"
if [[ "$target_count" != "1" ]]; then
  echo "対象の招待済みまたは有効な管理者を一意に特定できませんでした。" >&2
  exit 1
fi

"${repository}/scripts/production-backup.sh" operational >/dev/null

docker exec -i "$postgres_container" sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At' <<SQL >/dev/null
BEGIN;
WITH recovered_admin AS (
  UPDATE admin_users
     SET password_hash = '${password_hash}',
         status = 'INVITED',
         must_change_password = true,
         invited_at = COALESCE(invited_at, now()),
         activated_at = NULL,
         updated_at = now()
   WHERE login_id = '${login_id}'
     AND status IN ('INVITED', 'ACTIVE')
   RETURNING id
)
DELETE FROM admin_sessions
 WHERE admin_user_id IN (SELECT id FROM recovered_admin);
COMMIT;
SQL
unset password_hash

readonly recovered_status="$(
  docker exec "$postgres_container" sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc "$1"' \
    sh "SELECT status::text || '|' || must_change_password::text FROM admin_users WHERE login_id = '${login_id}';"
)"
if [[ "$recovered_status" != "INVITED|true" ]]; then
  echo "Administrator password recovery verification failed." >&2
  exit 1
fi

echo "管理者の一時パスワードを再設定し、既存セッションを失効しました。"
echo "ログインID: ${login_id}"
echo "次回ログイン時にパスワード変更が必要です。"
