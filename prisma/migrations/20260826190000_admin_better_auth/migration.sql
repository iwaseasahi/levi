-- The application switches administrator credentials and sessions to a
-- dedicated Better Auth realm. Existing administrator sessions are revoked.

ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "admin_users_bootstrap_credential_ck";
ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "admin_users_invitation_ck";

ALTER TABLE "admin_users"
  ADD COLUMN "email" CITEXT,
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "image" TEXT;

-- Existing installations do not yet have administrator email addresses. A
-- reserved, non-deliverable value keeps the migration deterministic; the
-- production cutover runbook must replace it before enabling email recovery.
UPDATE "admin_users"
SET "email" = lower("id"::text) || '@pending.invalid'
WHERE "email" IS NULL;

ALTER TABLE "admin_users" ALTER COLUMN "email" SET NOT NULL;
CREATE UNIQUE INDEX "admin_users_email_uk" ON "admin_users"("email");

CREATE TABLE "admin_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "account_id" VARCHAR(255) NOT NULL,
  "provider_id" VARCHAR(64) NOT NULL,
  "issuer" VARCHAR(255) NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "access_token_expires_at" TIMESTAMPTZ(3),
  "refresh_token_expires_at" TIMESTAMPTZ(3),
  "scope" TEXT,
  "id_token" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

INSERT INTO "admin_accounts" (
  "user_id", "account_id", "provider_id", "issuer", "password",
  "created_at", "updated_at"
)
SELECT
  "id", "id"::text, 'credential', 'local:credential', "password_hash",
  "created_at", "updated_at"
FROM "admin_users"
WHERE "password_hash" IS NOT NULL;

CREATE UNIQUE INDEX "admin_accounts_provider_account_uk"
  ON "admin_accounts"("provider_id", "account_id");
CREATE INDEX "admin_accounts_admin_user_idx" ON "admin_accounts"("user_id");
ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_admin_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

DELETE FROM "admin_sessions";
DROP INDEX IF EXISTS "admin_sessions_token_hash_uk";
DROP INDEX IF EXISTS "admin_sessions_admin_user_expires_idx";
ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "admin_sessions_admin_user_fk";
ALTER TABLE "admin_sessions" RENAME COLUMN "admin_user_id" TO "user_id";
ALTER TABLE "admin_sessions" DROP COLUMN "token_hash";
ALTER TABLE "admin_sessions"
  ADD COLUMN "token" VARCHAR(255) NOT NULL,
  ADD COLUMN "ip_address" VARCHAR(64),
  ADD COLUMN "user_agent" TEXT;
CREATE UNIQUE INDEX "admin_sessions_token_uk" ON "admin_sessions"("token");
CREATE INDEX "admin_sessions_admin_user_expires_idx"
  ON "admin_sessions"("user_id", "expires_at" DESC);
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "admin_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identifier" VARCHAR(255) NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_verifications_identifier_idx"
  ON "admin_verifications"("identifier");

CREATE TABLE "admin_rate_limits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(255) NOT NULL,
  "count" INTEGER NOT NULL,
  "last_request" BIGINT NOT NULL,
  CONSTRAINT "admin_rate_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_rate_limits_key_uk" ON "admin_rate_limits"("key");

ALTER TABLE "admin_users"
  DROP COLUMN "password_hash",
  DROP COLUMN "must_change_password";
