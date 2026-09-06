-- Version 2 adds application-owned rich-text blocks and marks while keeping
-- version 1 readable for existing rows and rollback compatibility.
ALTER TABLE "slides" DROP CONSTRAINT "slides_text_document_valid";

ALTER TABLE "slides" ADD CONSTRAINT "slides_text_document_valid" CHECK (
  (
    "content_type" = 'TEXT'
    AND (
      "text_document" IS NULL
      OR (
        jsonb_typeof("text_document") = 'object'
        AND (
          (
            "text_document" -> 'version' = '1'::jsonb
            AND jsonb_typeof("text_document" -> 'nodes') = 'array'
          )
          OR (
            "text_document" -> 'version' = '2'::jsonb
            AND jsonb_typeof("text_document" -> 'blocks') = 'array'
          )
        )
      )
    )
  )
  OR (
    "content_type" = 'IMAGE'
    AND "text_document" IS NULL
  )
);
