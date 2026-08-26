#!/usr/bin/env bash
set -euo pipefail

readonly production_environment="${LEVI_PRODUCTION_ENV_FILE:-/etc/levi/production.env}"
readonly backup_environment="${LEVI_BACKUP_ENV_FILE:-/etc/levi/backup.env}"
readonly monitoring_environment="${LEVI_MONITORING_ENV_FILE:-/etc/levi/monitoring.env}"
readonly backup_certificate="${LEVI_BACKUP_CERTIFICATE:-/etc/levi/backup-recipient.crt}"
readonly compose_file="${LEVI_COMPOSE_FILE:-/opt/levi/deploy/production/compose.yaml}"
readonly allow_rehearsal="${LEVI_ALLOW_NON_ROOT_FOR_REHEARSAL:-false}"

fail() {
  echo "Production secret configuration validation failed." >&2
  exit 1
}

if [[ "$allow_rehearsal" != "true" && "$allow_rehearsal" != "false" ]]; then
  fail
fi
if [[ "$EUID" -ne 0 && "$allow_rehearsal" != "true" ]]; then
  echo "Production secret configuration validation must run as root." >&2
  exit 2
fi

file_mode() {
  stat -c %a "$1" 2>/dev/null || stat -f %Lp "$1"
}

file_owner() {
  stat -c '%U:%G' "$1" 2>/dev/null || stat -f '%Su:%Sg' "$1"
}

require_protected_file() {
  local path="$1"
  [[ -f "$path" && "$(file_mode "$path")" == "600" ]] || fail
  if [[ "$allow_rehearsal" != "true" ]]; then
    [[ "$(file_owner "$path")" == "root:root" ]] || fail
  fi
}

value_for() {
  local file="$1"
  local key="$2"
  local count
  count="$(awk -F= -v key="$key" '$1 == key { count += 1 } END { print count + 0 }' "$file")"
  [[ "$count" == "1" ]] || fail
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print }' "$file"
}

require_protected_file "$production_environment"
require_protected_file "$backup_environment"
require_protected_file "$monitoring_environment"
[[ -f "$backup_certificate" ]] || fail
if [[ "$allow_rehearsal" != "true" ]]; then
  [[ "$(file_owner "$backup_certificate")" == "root:root" ]] || fail
fi
[[ "$(file_mode "$backup_certificate")" == "644" ]] || fail

if grep -Eqi 'replace-with|example\.invalid|PRIVATE KEY|BEGIN [A-Z ]*PRIVATE' \
  "$production_environment" "$backup_environment" "$monitoring_environment" \
  "$backup_certificate"; then
  fail
fi
openssl x509 -in "$backup_certificate" -noout -checkend 2592000 >/dev/null 2>&1 || fail

readonly app_database_url="$(value_for "$production_environment" DATABASE_URL)"
readonly migration_database_url="$(value_for "$production_environment" MIGRATION_DATABASE_URL)"
readonly shadow_database_url="$(value_for "$production_environment" MIGRATION_SHADOW_DATABASE_URL)"
readonly postgres_password="$(value_for "$production_environment" POSTGRES_PASSWORD)"
readonly app_password="$(value_for "$production_environment" LEVI_APP_DATABASE_PASSWORD)"
readonly better_auth_secret="$(value_for "$production_environment" BETTER_AUTH_SECRET)"
readonly admin_better_auth_secret="$(value_for "$production_environment" ADMIN_BETTER_AUTH_SECRET)"
readonly admin_hash="$(value_for "$production_environment" ADMIN_BASIC_AUTH_PASSWORD_HASH)"
readonly admin_username="$(value_for "$production_environment" ADMIN_BASIC_AUTH_USERNAME)"
readonly app_image="$(value_for "$production_environment" LEVI_IMAGE)"
readonly migration_image="$(value_for "$production_environment" LEVI_MIGRATION_IMAGE)"
readonly smtp_host="$(value_for "$production_environment" SMTP_HOST)"
readonly smtp_port="$(value_for "$production_environment" SMTP_PORT)"
readonly smtp_secure="$(value_for "$production_environment" SMTP_SECURE)"
readonly smtp_user="$(value_for "$production_environment" SMTP_USER)"
readonly smtp_password="$(value_for "$production_environment" SMTP_PASSWORD)"
readonly mail_from="$(value_for "$production_environment" MAIL_FROM)"

[[ "$(value_for "$production_environment" LEVI_DOMAIN)" == "levi-system.com" ]] || fail
[[ "$(value_for "$production_environment" NODE_ENV)" == "production" ]] || fail
[[ "$(value_for "$production_environment" BETTER_AUTH_BASE_URL)" == "https://levi-system.com" ]] || fail
[[ "$(value_for "$production_environment" BETTER_AUTH_TRUSTED_ORIGINS)" == "https://levi-system.com" ]] || fail
[[ "$(value_for "$production_environment" POSTGRES_DB)" == "levi" ]] || fail
[[ "$(value_for "$production_environment" POSTGRES_USER)" == "levi_admin" ]] || fail
[[ "$(value_for "$production_environment" ACME_EMAIL)" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail
[[ "$admin_username" =~ ^[A-Za-z0-9._@-]{3,64}$ ]] || fail
[[ "$admin_hash" =~ ^[a-f0-9]{32}:[a-f0-9]{128}$ ]] || fail
[[ "$better_auth_secret" =~ ^[a-f0-9]{64,128}$ ]] || fail
[[ "$admin_better_auth_secret" =~ ^[a-f0-9]{64,128}$ ]] || fail
[[ "$admin_better_auth_secret" != "$better_auth_secret" ]] || fail
[[ "$postgres_password" =~ ^[a-f0-9]{64}$ ]] || fail
[[ "$app_password" =~ ^[a-f0-9]{64}$ ]] || fail
[[ "$postgres_password" != "$app_password" ]] || fail
[[ "$app_image" =~ ^ghcr\.io/iwaseasahi/levi@sha256:[a-f0-9]{64}$ ]] || fail
[[ "$migration_image" =~ ^ghcr\.io/iwaseasahi/levi-migrate@sha256:[a-f0-9]{64}$ ]] || fail
[[ "$app_database_url" == "postgresql://levi_app:${app_password}@postgres:5432/levi?schema=public" ]] || fail
[[ "$migration_database_url" == "postgresql://levi_admin:${postgres_password}@postgres:5432/levi?schema=public" ]] || fail
[[ "$shadow_database_url" == "postgresql://levi_admin:${postgres_password}@postgres:5432/levi_shadow?schema=public" ]] || fail
[[ "$smtp_host" == "smtp.gmail.com" ]] || fail
[[ "$smtp_port" == "587" ]] || fail
[[ "$smtp_secure" == "false" ]] || fail
[[ "$smtp_user" == "levi.system.app@gmail.com" ]] || fail
[[ "$mail_from" == "$smtp_user" ]] || fail
[[ "$smtp_password" =~ ^[^[:space:]]{16,128}$ ]] || fail

[[ "$(value_for "$backup_environment" LEVI_ENV_FILE)" == "$production_environment" ]] || fail
[[ "$(value_for "$backup_environment" LEVI_BACKUP_CERTIFICATE)" == "$backup_certificate" ]] || fail
[[ "$(value_for "$monitoring_environment" LEVI_ENV_FILE)" == "$production_environment" ]] || fail
readonly slack_webhook_count="$(awk -F= '$1 == "LEVI_SLACK_WEBHOOK_URL" { count += 1 } END { print count + 0 }' "$monitoring_environment")"
[[ "$slack_webhook_count" == "0" || "$slack_webhook_count" == "1" ]] || fail
if [[ "$slack_webhook_count" == "1" ]]; then
  readonly slack_webhook="$(value_for "$monitoring_environment" LEVI_SLACK_WEBHOOK_URL)"
  [[ -z "$slack_webhook" || "$slack_webhook" =~ ^https://hooks\.slack\.com/services/[A-Za-z0-9_/-]+$ ]] || fail
fi

docker compose --env-file "$production_environment" --file "$compose_file" config --quiet >/dev/null || fail

echo "Production secret configuration passed without disclosing values."
