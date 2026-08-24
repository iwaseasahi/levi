-- Preserve an omitted ending verse instead of conflating it with an explicitly
-- selected single-verse range. Bookmark titles are system-generated and cannot
-- be edited, so existing titles without a trailing numeric range identify the
-- records created with an omitted ending verse.
ALTER TABLE "scripture_bookmarks"
    DROP CONSTRAINT "scripture_bookmarks_range_ck",
    ALTER COLUMN "end_verse" DROP NOT NULL;

UPDATE "scripture_bookmarks" AS scripture
SET "end_verse" = NULL
FROM "bookmarks" AS bookmark
WHERE bookmark."id" = scripture."bookmark_id"
  AND bookmark."title" !~ ' [0-9]+:[0-9]+-[0-9]+$';

ALTER TABLE "scripture_bookmarks"
    ADD CONSTRAINT "scripture_bookmarks_range_ck" CHECK (
        "chapter_number" > 0
        AND "start_verse" >= 0
        AND (
            "end_verse" IS NULL
            OR "end_verse" >= "start_verse"
        )
    );
