-- Administrator authentication now uses the unique email address directly.
-- Keep the legacy column nullable for one rollback window; the application no
-- longer reads or writes it, and a later forward migration can drop it.
ALTER TABLE "admin_users" ALTER COLUMN "login_id" DROP NOT NULL;
