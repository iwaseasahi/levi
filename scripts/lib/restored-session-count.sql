SELECT 'SELECT (SELECT count(*) FROM sessions)' ||
  CASE WHEN to_regclass('public.admin_sessions') IS NULL THEN ''
    ELSE ' + (SELECT count(*) FROM admin_sessions)' END || ';'
\gexec
