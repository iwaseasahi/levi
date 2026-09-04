-- The explicit, synthetic deletion set represents an operator-reviewed recovery
-- record. It is not inferred from the archive and is never a production default.
DO $$ BEGIN
 IF current_database() !~ '^levi_(backup_source|restore_rehearsal)_[0-9]+$' THEN
  RAISE EXCEPTION 'Synthetic deletion rehearsal database required';
 END IF;
END $$;
DELETE FROM slides WHERE id = '00000000-0000-4000-8000-000000389012'
 AND church_id = '00000000-0000-4000-8000-000000389002';
DELETE FROM churches WHERE id = '00000000-0000-4000-8000-000000389001';
DO $$ BEGIN
 IF (SELECT count(*) FROM slides) <> 2
  OR NOT EXISTS (SELECT 1 FROM slides WHERE id = '00000000-0000-4000-8000-000000389013'
   AND church_id = '00000000-0000-4000-8000-000000389002' AND revision = 3
   AND body = E'日本語\n\n\n\nSecond')
  OR NOT EXISTS (
   SELECT 1 FROM slide_images
   WHERE slide_id = '00000000-0000-4000-8000-000000389014'
    AND church_id = '00000000-0000-4000-8000-000000389002'
    AND checksum = 'b4fc99c5e2ebf22b2b2eb35cdb9b02fbc03fceaa90aa2f10f69c428f3e440b57'
    AND byte_size = octet_length(data)
  )
  OR NOT EXISTS (SELECT 1 FROM scripture_bookmarks WHERE bookmark_id = '00000000-0000-4000-8000-000000389031')
  OR NOT EXISTS (SELECT 1 FROM bible_verses WHERE book_id = '00000000-0000-4000-8000-000000389020' AND text = 'Synthetic recovery verse') THEN
  RAISE EXCEPTION 'Slide deletion/recovery tenant boundary failed';
 END IF;
END $$;
