-- Correct the English translation identity after profiling the approved legacy
-- production dump. Existing Issue #46 environments contain metadata only.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "bible_translations" WHERE "code" = 'KJV') THEN
        IF EXISTS (
            SELECT 1
            FROM "bible_translations" AS translation
            WHERE translation."code" = 'KJV'
              AND (
                  translation."rights_status" <> 'PENDING'
                  OR EXISTS (
                      SELECT 1 FROM "bible_verses" AS verse
                      WHERE verse."translation_id" = translation."id"
                  )
              )
        ) THEN
            RAISE EXCEPTION 'cannot automatically correct a populated or approved KJV translation';
        END IF;

        UPDATE "bible_translations"
        SET "code" = 'NKJV',
            "name" = 'New King James Version',
            "updated_at" = CURRENT_TIMESTAMP
        WHERE "code" = 'KJV';
    END IF;
END;
$$;
