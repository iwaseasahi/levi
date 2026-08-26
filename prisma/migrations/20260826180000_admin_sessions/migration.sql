CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_sessions_token_hash_uk" ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_admin_user_expires_idx" ON "admin_sessions"("admin_user_id", "expires_at" DESC);
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions"("expires_at");

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_fk"
FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
