-- Ginmaku contains 116 verse-zero rows. They are source data, not missing or
-- invalid records, and must remain addressable without changing their values.
ALTER TABLE "bible_verses"
    DROP CONSTRAINT "bible_verses_numbers_ck",
    ADD CONSTRAINT "bible_verses_numbers_ck"
        CHECK ("chapter_number" > 0 AND "verse_number" >= 0);
