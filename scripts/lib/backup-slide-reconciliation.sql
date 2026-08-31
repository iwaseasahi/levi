-- Dynamic SQL keeps backups/restores of pre-Slide databases supported.
-- Fingerprint every stored field, including church ownership and revision.
SELECT CASE WHEN to_regclass('public.slides') IS NULL
  THEN $$SELECT 'absent';$$
  ELSE $$SELECT count(*)::text || ':' || md5(coalesce(string_agg(
    md5(to_jsonb(s)::text), ',' ORDER BY s.id), '')) FROM public.slides s;$$
END
\gexec
