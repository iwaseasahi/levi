-- Administrator authentication has used the unique email address since the
-- preceding compatibility migration. The rollback window is now closed, so
-- remove the unused legacy identifier and its unique index.
DROP INDEX IF EXISTS "admin_users_login_id_uk";
ALTER TABLE "admin_users" DROP COLUMN "login_id";
