-- Expand only: no legacy data import, backfill, or change to existing rows.
CREATE TABLE "slides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "church_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "author" VARCHAR(200),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "slides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "slides_title_valid" CHECK (
        char_length("title") BETWEEN 1 AND 200
        AND "title" = btrim("title", E' \t\n\r')
        AND "title" !~ E'[\t\n\r]'
    ),
    CONSTRAINT "slides_body_valid" CHECK (
        char_length("body") BETWEEN 1 AND 100000
        AND char_length(btrim("body", E' \t\n')) > 0
        AND position(E'\r' IN "body") = 0
    ),
    CONSTRAINT "slides_author_valid" CHECK (
        "author" IS NULL OR (
            char_length("author") BETWEEN 1 AND 200
            AND "author" = btrim("author", E' \t\n\r')
            AND "author" !~ E'[\t\n\r]'
        )
    ),
    CONSTRAINT "slides_revision_positive" CHECK ("revision" > 0),
    -- Church owns Slide; user deletion never deletes church content.
    CONSTRAINT "slides_church_id_fkey" FOREIGN KEY ("church_id")
        REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "slides_church_created_id_idx"
    ON "slides"("church_id", "created_at" DESC, "id" DESC);
CREATE INDEX "slides_church_updated_id_idx"
    ON "slides"("church_id", "updated_at" DESC, "id" DESC);
