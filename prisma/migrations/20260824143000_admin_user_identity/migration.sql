CREATE TYPE "admin_user_status" AS ENUM ('BOOTSTRAP', 'INVITED', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "login_id" CITEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "password_hash" TEXT,
    "status" "admin_user_status" NOT NULL DEFAULT 'INVITED',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "invited_by_admin_user_id" UUID,
    "invited_at" TIMESTAMPTZ(3),
    "activated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_users_bootstrap_credential_ck" CHECK (
        "status" <> 'BOOTSTRAP' OR ("password_hash" IS NULL AND "must_change_password" = false)
    ),
    CONSTRAINT "admin_users_invitation_ck" CHECK (
        "status" <> 'INVITED' OR ("password_hash" IS NOT NULL AND "must_change_password" = true AND "invited_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "admin_users_login_id_uk" ON "admin_users"("login_id");
CREATE INDEX "admin_users_status_created_idx" ON "admin_users"("status", "created_at" DESC);

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_inviter_fk"
FOREIGN KEY ("invited_by_admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

INSERT INTO "admin_users" (
    "id", "login_id", "name", "status", "must_change_password"
) VALUES (
    '00000000-0000-4000-8000-000000000201',
    'basic-bootstrap',
    'Levi Basic Bootstrap Administrator',
    'BOOTSTRAP',
    false
) ON CONFLICT ("id") DO NOTHING;

DROP TRIGGER IF EXISTS "platform_operators_actor_assignment_ck" ON "platform_operators";
DROP TRIGGER IF EXISTS "users_actor_assignment_ck" ON "users";
DROP TRIGGER IF EXISTS "church_memberships_actor_assignment_ck" ON "church_memberships";

DROP TABLE "platform_operators";

DELETE FROM "users"
WHERE "id" = '00000000-0000-4000-8000-000000000201'
  AND NOT EXISTS (SELECT 1 FROM "church_memberships" WHERE "user_id" = "users"."id")
  AND NOT EXISTS (SELECT 1 FROM "accounts" WHERE "user_id" = "users"."id")
  AND NOT EXISTS (SELECT 1 FROM "sessions" WHERE "user_id" = "users"."id");

CREATE OR REPLACE FUNCTION "check_user_actor_assignment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_ids UUID[];
    target_user_id UUID;
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
        SELECT "actor_state" INTO target_actor_state
          FROM "users"
         WHERE "id" = target_user_id
           FOR UPDATE;

        IF FOUND THEN
            SELECT count(*) FROM "church_memberships" WHERE "user_id" = target_user_id
              INTO assignment_count;

            IF (target_actor_state = 'ACTIVE' AND assignment_count <> 1)
               OR (target_actor_state = 'PENDING' AND assignment_count <> 0) THEN
                RAISE EXCEPTION 'invalid actor assignment for user'
                    USING ERRCODE = '23514', CONSTRAINT = 'actor_assignment_ck';
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

CREATE CONSTRAINT TRIGGER "church_memberships_actor_assignment_ck"
AFTER INSERT OR UPDATE OR DELETE ON "church_memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_user_actor_assignment"();
