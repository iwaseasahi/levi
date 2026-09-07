-- Slide rich-text migration is complete. Fail closed before removing the
-- former plain-text copy so an incompletely migrated environment keeps its data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "slides"
    WHERE
      ("content_type" = 'TEXT' AND (
        "text_document" IS NULL
        OR jsonb_typeof("text_document") IS DISTINCT FROM 'object'
        OR "text_document" -> 'version' IS DISTINCT FROM '2'::jsonb
        OR jsonb_typeof("text_document" -> 'blocks') IS DISTINCT FROM 'array'
      ))
      OR ("content_type" = 'IMAGE' AND "text_document" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'slides.text_document migration is incomplete; refusing to drop slides.body'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

-- Validate the replacement invariant before removing any old constraint or
-- column. NOT VALID avoids taking the validation scan under the add-constraint
-- lock; VALIDATE performs the explicit pre-drop scan.
ALTER TABLE "slides" ADD CONSTRAINT "slides_text_document_required" CHECK ((
  (
    "content_type" = 'TEXT'
    AND "text_document" IS NOT NULL
    AND jsonb_typeof("text_document") = 'object'
    AND "text_document" -> 'version' = '2'::jsonb
    AND jsonb_typeof("text_document" -> 'blocks') = 'array'
  )
  OR (
    "content_type" = 'IMAGE'
    AND "text_document" IS NULL
  )
) IS TRUE) NOT VALID;

ALTER TABLE "slides" VALIDATE CONSTRAINT "slides_text_document_required";

DROP TRIGGER "slides_clear_stale_text_document" ON "slides";
DROP FUNCTION "clear_stale_slide_text_document"();

ALTER TABLE "slides"
  DROP CONSTRAINT "slides_content_valid",
  DROP CONSTRAINT "slides_text_document_valid",
  DROP COLUMN "body";

ALTER TABLE "slides"
  RENAME CONSTRAINT "slides_text_document_required" TO "slides_text_document_valid";
