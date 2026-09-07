-- Vertical placement is a Slide setting, not authored rich-text or CSS. Keep
-- existing text rows nullable so the application can preserve their historical
-- centered rendering without a data rewrite. Image Slides must not carry it.
CREATE TYPE "slide_vertical_alignment" AS ENUM ('TOP', 'CENTER', 'BOTTOM');

ALTER TABLE "slides"
  ADD COLUMN "vertical_alignment" "slide_vertical_alignment";

ALTER TABLE "slides" ADD CONSTRAINT "slides_vertical_alignment_valid" CHECK (
  "content_type" = 'TEXT' OR "vertical_alignment" IS NULL
) NOT VALID;

ALTER TABLE "slides" VALIDATE CONSTRAINT "slides_vertical_alignment_valid";
