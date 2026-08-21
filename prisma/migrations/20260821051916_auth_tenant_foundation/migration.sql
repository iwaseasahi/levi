-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "user_actor_state" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "church_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "email" CITEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "actor_state" "user_actor_state" NOT NULL DEFAULT 'PENDING',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
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

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(255) NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "churches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "status" "church_status" NOT NULL DEFAULT 'ACTIVE',
    "suspended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "churches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_operators" (
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "church_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "church_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_uk" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_issuer_account_uk" ON "accounts"("issuer", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_provider_uk" ON "accounts"("user_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_uk" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_expires_idx" ON "sessions"("user_id", "expires_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "verifications_expires_idx" ON "verifications"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_uk" ON "rate_limits"("key");

-- CreateIndex
CREATE INDEX "rate_limits_last_request_idx" ON "rate_limits"("last_request");

-- CreateIndex
CREATE UNIQUE INDEX "church_memberships_church_uk" ON "church_memberships"("church_id");

-- CreateIndex
CREATE UNIQUE INDEX "church_memberships_user_uk" ON "church_memberships"("user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "platform_operators" ADD CONSTRAINT "platform_operators_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "church_memberships" ADD CONSTRAINT "church_memberships_church_fk" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "church_memberships" ADD CONSTRAINT "church_memberships_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddCheckConstraints
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_normalized_ck"
        CHECK (
            "email"::TEXT = lower(btrim("email"::TEXT))
            AND length("email"::TEXT) <= 320
        ),
    ADD CONSTRAINT "users_name_nonblank_ck"
        CHECK (length(btrim("name")) > 0);

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_credential_only_ck"
        CHECK (
            "provider_id" = 'credential'
            AND "issuer" = 'local:credential'
            AND "account_id" = "user_id"::TEXT
            AND "password" IS NOT NULL
            AND "access_token" IS NULL
            AND "refresh_token" IS NULL
            AND "access_token_expires_at" IS NULL
            AND "refresh_token_expires_at" IS NULL
            AND "scope" IS NULL
            AND "id_token" IS NULL
        ),
    ADD CONSTRAINT "accounts_password_hash_format_ck"
        CHECK ("password" ~ '^[0-9a-f]{32}:[0-9a-f]{128}$');

ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_expiry_order_ck"
        CHECK ("expires_at" > "created_at");

ALTER TABLE "verifications"
    ADD CONSTRAINT "verifications_expiry_order_ck"
        CHECK ("expires_at" > "created_at");

ALTER TABLE "rate_limits"
    ADD CONSTRAINT "rate_limits_count_ck" CHECK ("count" >= 0),
    ADD CONSTRAINT "rate_limits_last_request_ck" CHECK ("last_request" >= 0);

ALTER TABLE "churches"
    ADD CONSTRAINT "churches_name_nonblank_ck"
        CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "churches_suspension_ck"
        CHECK (
            ("status" = 'ACTIVE' AND "suspended_at" IS NULL)
            OR ("status" = 'SUSPENDED' AND "suspended_at" IS NOT NULL)
        );

-- AddDeferredActorAssignmentConstraint
CREATE FUNCTION "check_user_actor_assignment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_id UUID;
    target_user_ids UUID[];
    target_actor_state "user_actor_state";
    assignment_count INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'users' THEN
            target_user_ids := ARRAY[NEW."id"];
        ELSE
            target_user_ids := ARRAY[NEW."user_id"];
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'users' THEN
            target_user_ids := ARRAY[OLD."id"];
        ELSE
            target_user_ids := ARRAY[OLD."user_id"];
        END IF;
    ELSIF TG_TABLE_NAME = 'users' THEN
        target_user_ids := ARRAY[NEW."id", OLD."id"];
    ELSE
        target_user_ids := ARRAY[NEW."user_id", OLD."user_id"];
    END IF;

    FOREACH target_user_id IN ARRAY target_user_ids LOOP
        SELECT "actor_state"
          INTO target_actor_state
          FROM "users"
         WHERE "id" = target_user_id
           FOR UPDATE;

        IF FOUND THEN
            SELECT
                (SELECT count(*) FROM "platform_operators" WHERE "user_id" = target_user_id)
                + (SELECT count(*) FROM "church_memberships" WHERE "user_id" = target_user_id)
              INTO assignment_count;

            IF (target_actor_state = 'ACTIVE' AND assignment_count <> 1)
               OR (target_actor_state = 'PENDING' AND assignment_count <> 0) THEN
                RAISE EXCEPTION 'invalid actor assignment for user'
                    USING ERRCODE = '23514',
                          CONSTRAINT = 'actor_assignment_ck';
            END IF;
        END IF;
    END LOOP;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "users_actor_assignment_ck"
AFTER INSERT OR UPDATE OR DELETE ON "users"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_user_actor_assignment"();

CREATE CONSTRAINT TRIGGER "platform_operators_actor_assignment_ck"
AFTER INSERT OR UPDATE OR DELETE ON "platform_operators"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_user_actor_assignment"();

CREATE CONSTRAINT TRIGGER "church_memberships_actor_assignment_ck"
AFTER INSERT OR UPDATE OR DELETE ON "church_memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_user_actor_assignment"();
