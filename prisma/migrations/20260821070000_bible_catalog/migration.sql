-- CreateEnum
CREATE TYPE "bible_rights_status" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "bible_testament" AS ENUM ('OLD', 'NEW');

-- CreateTable
CREATE TABLE "bible_translations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "language_tag" VARCHAR(35) NOT NULL,
    "display_order" SMALLINT NOT NULL,
    "rights_status" "bible_rights_status" NOT NULL,
    "source_reference" TEXT,
    "rights_notice" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bible_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bible_books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canonical_code" VARCHAR(16) NOT NULL,
    "canonical_order" SMALLINT NOT NULL,
    "testament" "bible_testament" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bible_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bible_book_names" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "translation_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(40),

    CONSTRAINT "bible_book_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bible_verses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "translation_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "chapter_number" SMALLINT NOT NULL,
    "verse_number" SMALLINT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bible_verses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bible_translations_code_uk" ON "bible_translations"("code");
CREATE UNIQUE INDEX "bible_translations_display_order_uk" ON "bible_translations"("display_order");
CREATE UNIQUE INDEX "bible_books_canonical_code_uk" ON "bible_books"("canonical_code");
CREATE UNIQUE INDEX "bible_books_canonical_order_uk" ON "bible_books"("canonical_order");
CREATE UNIQUE INDEX "bible_book_names_translation_book_uk" ON "bible_book_names"("translation_id", "book_id");
CREATE UNIQUE INDEX "bible_book_names_translation_name_uk" ON "bible_book_names"("translation_id", "name");
CREATE UNIQUE INDEX "bible_verses_location_uk" ON "bible_verses"("translation_id", "book_id", "chapter_number", "verse_number");
CREATE INDEX "bible_verses_navigation_idx" ON "bible_verses"("book_id", "chapter_number", "verse_number", "translation_id");

-- AddForeignKey
ALTER TABLE "bible_book_names" ADD CONSTRAINT "bible_book_names_translation_fk" FOREIGN KEY ("translation_id") REFERENCES "bible_translations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "bible_book_names" ADD CONSTRAINT "bible_book_names_book_fk" FOREIGN KEY ("book_id") REFERENCES "bible_books"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_translation_fk" FOREIGN KEY ("translation_id") REFERENCES "bible_translations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_book_fk" FOREIGN KEY ("book_id") REFERENCES "bible_books"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddCheckConstraints
ALTER TABLE "bible_translations"
    ADD CONSTRAINT "bible_translations_code_ck"
        CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,15}$'),
    ADD CONSTRAINT "bible_translations_name_nonblank_ck"
        CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "bible_translations_language_tag_ck"
        CHECK ("language_tag" ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'),
    ADD CONSTRAINT "bible_translations_display_order_ck"
        CHECK ("display_order" > 0),
    ADD CONSTRAINT "bible_translations_rights_ck"
        CHECK (
            "rights_status" = 'PENDING'
            OR (
                "rights_status" = 'APPROVED'
                AND "source_reference" IS NOT NULL
                AND "rights_notice" IS NOT NULL
                AND length(btrim("source_reference")) > 0
                AND length(btrim("rights_notice")) > 0
            )
        );

ALTER TABLE "bible_books"
    ADD CONSTRAINT "bible_books_canonical_code_ck"
        CHECK ("canonical_code" ~ '^[A-Z0-9][A-Z0-9_-]{0,15}$'),
    ADD CONSTRAINT "bible_books_canonical_order_ck"
        CHECK ("canonical_order" > 0);

ALTER TABLE "bible_book_names"
    ADD CONSTRAINT "bible_book_names_name_nonblank_ck"
        CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "bible_book_names_short_name_nonblank_ck"
        CHECK ("short_name" IS NULL OR length(btrim("short_name")) > 0);

ALTER TABLE "bible_verses"
    ADD CONSTRAINT "bible_verses_numbers_ck"
        CHECK ("chapter_number" > 0 AND "verse_number" > 0);
