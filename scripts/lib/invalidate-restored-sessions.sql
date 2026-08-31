DELETE FROM sessions;
SELECT 'DELETE FROM admin_sessions;'
WHERE to_regclass('public.admin_sessions') IS NOT NULL
\gexec
