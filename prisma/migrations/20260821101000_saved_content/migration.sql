-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "folders_id_church_uk" UNIQUE ("id", "church_id"),
    CONSTRAINT "folders_church_position_uk"
        UNIQUE ("church_id", "position") DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT "folders_position_ck" CHECK ("position" >= 0),
    CONSTRAINT "folders_name_nonblank_ck" CHECK (length(btrim("name")) > 0)
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bookmarks_folder_position_uk"
        UNIQUE ("folder_id", "position") DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT "bookmarks_position_ck" CHECK ("position" >= 0),
    CONSTRAINT "bookmarks_title_nonblank_ck" CHECK (length(btrim("title")) > 0)
);

-- CreateTable
CREATE TABLE "scripture_bookmarks" (
    "bookmark_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_number" SMALLINT NOT NULL,
    "start_verse" SMALLINT NOT NULL,
    "end_verse" SMALLINT NOT NULL,
    "primary_translation_id" UUID NOT NULL,
    "secondary_translation_id" UUID,

    CONSTRAINT "scripture_bookmarks_pkey" PRIMARY KEY ("bookmark_id"),
    CONSTRAINT "scripture_bookmarks_range_ck" CHECK (
        "chapter_number" > 0
        AND "start_verse" >= 0
        AND "end_verse" >= "start_verse"
    ),
    CONSTRAINT "scripture_bookmarks_translations_ck" CHECK (
        "secondary_translation_id" IS NULL
        OR "secondary_translation_id" <> "primary_translation_id"
    )
);

-- CreateIndex
CREATE INDEX "folders_pinned_idx"
    ON "folders"("church_id", "is_pinned" DESC, "position", "id");
CREATE INDEX "folders_recent_idx"
    ON "folders"("church_id", "last_used_at" DESC NULLS LAST, "position", "id");
CREATE INDEX "bookmarks_church_folder_position_idx"
    ON "bookmarks"("church_id", "folder_id", "position", "id");

-- AddForeignKey
ALTER TABLE "folders"
    ADD CONSTRAINT "folders_church_fk"
    FOREIGN KEY ("church_id") REFERENCES "churches"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "bookmarks"
    ADD CONSTRAINT "bookmarks_folder_church_fk"
    FOREIGN KEY ("folder_id", "church_id")
    REFERENCES "folders"("id", "church_id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "scripture_bookmarks"
    ADD CONSTRAINT "scripture_bookmarks_bookmark_fk"
        FOREIGN KEY ("bookmark_id") REFERENCES "bookmarks"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_book_fk"
        FOREIGN KEY ("book_id") REFERENCES "bible_books"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_primary_translation_fk"
        FOREIGN KEY ("primary_translation_id") REFERENCES "bible_translations"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_secondary_translation_fk"
        FOREIGN KEY ("secondary_translation_id") REFERENCES "bible_translations"("id")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_primary_start_fk"
        FOREIGN KEY ("primary_translation_id", "book_id", "chapter_number", "start_verse")
        REFERENCES "bible_verses"("translation_id", "book_id", "chapter_number", "verse_number")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_primary_end_fk"
        FOREIGN KEY ("primary_translation_id", "book_id", "chapter_number", "end_verse")
        REFERENCES "bible_verses"("translation_id", "book_id", "chapter_number", "verse_number")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_secondary_start_fk"
        FOREIGN KEY ("secondary_translation_id", "book_id", "chapter_number", "start_verse")
        REFERENCES "bible_verses"("translation_id", "book_id", "chapter_number", "verse_number")
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    ADD CONSTRAINT "scripture_bookmarks_secondary_end_fk"
        FOREIGN KEY ("secondary_translation_id", "book_id", "chapter_number", "end_verse")
        REFERENCES "bible_verses"("translation_id", "book_id", "chapter_number", "verse_number")
        ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Enforce Bookmark's required ScriptureBookmark subtype at transaction commit.
CREATE FUNCTION "enforce_bookmark_scripture_total"()
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

    IF NOT EXISTS (
        SELECT 1 FROM "bookmarks" WHERE "id" = target_bookmark_id
    ) THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO subtype_count
    FROM "scripture_bookmarks"
    WHERE "bookmark_id" = target_bookmark_id;

    IF subtype_count <> 1 THEN
        RAISE EXCEPTION 'bookmark % must have exactly one scripture subtype', target_bookmark_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "bookmarks_scripture_total_ck"
AFTER INSERT OR UPDATE OR DELETE ON "bookmarks"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_bookmark_scripture_total"();

CREATE CONSTRAINT TRIGGER "scripture_bookmarks_total_ck"
AFTER INSERT OR UPDATE OR DELETE ON "scripture_bookmarks"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_bookmark_scripture_total"();
