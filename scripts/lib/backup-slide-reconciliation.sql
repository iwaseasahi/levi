-- Dynamic SQL keeps backups/restores of pre-Slide and pre-image databases
-- supported. Image bytes are hashed in PostgreSQL so they are verified without
-- being printed into logs or restore artifacts.
SELECT CASE WHEN to_regclass('public.slides') IS NULL
  THEN $$SELECT 'absent';$$
  WHEN to_regclass('public.slide_images') IS NOT NULL
  THEN $$SELECT
    ((SELECT count(*) FROM public.slides) +
     (SELECT count(*) FROM public.slide_images))::text || ':' ||
    md5(
      coalesce((SELECT string_agg('slide:' || md5(to_jsonb(s)::text), ',' ORDER BY s.id)
                FROM public.slides s), '') || '|' ||
      coalesce((SELECT string_agg(
        'image:' || md5(concat_ws('|', i.slide_id::text, i.church_id::text,
          i.media_type, i.byte_size::text, i.width::text, i.height::text,
          i.checksum, md5(i.data), i.created_at::text, i.updated_at::text)),
        ',' ORDER BY i.slide_id) FROM public.slide_images i), '')
    );$$
  ELSE $$SELECT count(*)::text || ':' || md5(coalesce(string_agg(
    md5(to_jsonb(s)::text), ',' ORDER BY s.id), '')) FROM public.slides s;$$
END
\gexec
