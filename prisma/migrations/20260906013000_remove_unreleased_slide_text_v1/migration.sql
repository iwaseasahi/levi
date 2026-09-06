-- Version 1 was never released to production. Remove its temporary compatibility
-- path before this feature ships and retain the existing plain-body fallback.
UPDATE "slides"
SET "text_document" = NULL
WHERE "text_document" -> 'version' = '1'::jsonb;

ALTER TABLE "slides" DROP CONSTRAINT "slides_text_document_valid";

ALTER TABLE "slides" ADD CONSTRAINT "slides_text_document_valid" CHECK (
  (
    "content_type" = 'TEXT'
    AND (
      "text_document" IS NULL
      OR (
        jsonb_typeof("text_document") = 'object'
        AND "text_document" -> 'version' = '2'::jsonb
        AND jsonb_typeof("text_document" -> 'blocks') = 'array'
      )
    )
  )
  OR (
    "content_type" = 'IMAGE'
    AND "text_document" IS NULL
  )
);
