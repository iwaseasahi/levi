-- Existing rows remain text Slides. Image bytes are kept in a dedicated table
-- so ordinary Slide list/detail queries cannot accidentally load them.
CREATE TYPE "slide_content_type" AS ENUM ('TEXT', 'IMAGE');

ALTER TABLE "slides"
  ADD COLUMN "content_type" "slide_content_type" NOT NULL DEFAULT 'TEXT',
  ALTER COLUMN "body" DROP NOT NULL,
  DROP CONSTRAINT "slides_body_valid";

ALTER TABLE "slides" ADD CONSTRAINT "slides_content_valid" CHECK (
  (
    "content_type" = 'TEXT'
    AND "body" IS NOT NULL
    AND char_length("body") BETWEEN 1 AND 100000
    AND char_length(btrim("body", E' \t\n')) > 0
    AND position(E'\r' IN "body") = 0
  ) OR (
    "content_type" = 'IMAGE'
    AND "body" IS NULL
  )
);

CREATE TABLE "slide_images" (
  "slide_id" UUID NOT NULL,
  "church_id" UUID NOT NULL,
  "media_type" VARCHAR(10) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "checksum" CHAR(64) NOT NULL,
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "slide_images_pkey" PRIMARY KEY ("slide_id"),
  CONSTRAINT "slide_images_slide_church_uk" UNIQUE ("slide_id", "church_id"),
  CONSTRAINT "slide_images_media_type_valid" CHECK (
    "media_type" IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT "slide_images_byte_size_valid" CHECK (
    "byte_size" BETWEEN 1 AND 10485760
    AND "byte_size" = octet_length("data")
  ),
  CONSTRAINT "slide_images_dimensions_valid" CHECK (
    "width" BETWEEN 1 AND 8192
    AND "height" BETWEEN 1 AND 8192
    AND "width"::bigint * "height"::bigint <= 40000000
  ),
  CONSTRAINT "slide_images_checksum_valid" CHECK (
    "checksum" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "slide_images_slide_church_fk" FOREIGN KEY ("slide_id", "church_id")
    REFERENCES "slides"("id", "church_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "slide_images_church_id_idx" ON "slide_images"("church_id");
