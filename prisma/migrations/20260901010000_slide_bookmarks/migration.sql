-- Add a typed Slide bookmark. No legacy data is imported or backfilled.
ALTER TABLE "bookmarks"
    ADD CONSTRAINT "bookmarks_id_church_uk" UNIQUE ("id", "church_id");
ALTER TABLE "slides"
    ADD CONSTRAINT "slides_id_church_uk" UNIQUE ("id", "church_id");

CREATE TABLE "slide_bookmarks" (
    "bookmark_id" UUID NOT NULL,
    "church_id" UUID NOT NULL,
    "slide_id" UUID NOT NULL,
    CONSTRAINT "slide_bookmarks_pkey" PRIMARY KEY ("bookmark_id"),
    CONSTRAINT "slide_bookmarks_bookmark_church_uk" UNIQUE ("bookmark_id", "church_id"),
    CONSTRAINT "slide_bookmarks_bookmark_church_fk"
        FOREIGN KEY ("bookmark_id", "church_id")
        REFERENCES "bookmarks"("id", "church_id")
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "slide_bookmarks_slide_church_fk"
        FOREIGN KEY ("slide_id", "church_id")
        REFERENCES "slides"("id", "church_id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "slide_bookmarks_church_slide_idx"
    ON "slide_bookmarks"("church_id", "slide_id", "bookmark_id");

CREATE OR REPLACE FUNCTION "enforce_bookmark_scripture_total"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_bookmark_id UUID;
    subtype_count INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'bookmarks' THEN
        target_bookmark_id := COALESCE(NEW."id", OLD."id");
    ELSE
        target_bookmark_id := COALESCE(NEW."bookmark_id", OLD."bookmark_id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "bookmarks" WHERE "id" = target_bookmark_id) THEN
        RETURN NULL;
    END IF;
    SELECT
        (SELECT count(*) FROM "scripture_bookmarks" WHERE "bookmark_id" = target_bookmark_id)
        + (SELECT count(*) FROM "slide_bookmarks" WHERE "bookmark_id" = target_bookmark_id)
    INTO subtype_count;
    IF subtype_count <> 1 THEN
        RAISE EXCEPTION 'bookmark % must have exactly one typed subtype', target_bookmark_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "slide_bookmarks_total_ck"
AFTER INSERT OR UPDATE OR DELETE ON "slide_bookmarks"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_bookmark_scripture_total"();
