-- Rich text is additive and nullable so the schema can precede the application.
-- Existing text Slides continue to use body and are upgraded on their next save.
ALTER TABLE "slides" ADD COLUMN "text_document" JSONB;

ALTER TABLE "slides" ADD CONSTRAINT "slides_text_document_valid" CHECK (
  (
    "content_type" = 'TEXT'
    AND (
      "text_document" IS NULL
      OR (
        jsonb_typeof("text_document") = 'object'
        AND "text_document" -> 'version' = '1'::jsonb
        AND jsonb_typeof("text_document" -> 'nodes') = 'array'
      )
    )
  )
  OR (
    "content_type" = 'IMAGE'
    AND "text_document" IS NULL
  )
);

-- A rolled-back application only knows body. If it changes body while leaving
-- the rich document untouched, discard the now-stale document rather than
-- resurrecting old formatting when the new application returns.
CREATE FUNCTION "clear_stale_slide_text_document"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."content_type" = 'IMAGE' THEN
    NEW."text_document" := NULL;
  ELSIF OLD."content_type" = 'TEXT'
    AND NEW."content_type" = 'TEXT'
    AND NEW."body" IS DISTINCT FROM OLD."body"
    AND NEW."text_document" IS NOT DISTINCT FROM OLD."text_document" THEN
    NEW."text_document" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "slides_clear_stale_text_document"
BEFORE UPDATE OF "body", "content_type", "text_document" ON "slides"
FOR EACH ROW EXECUTE FUNCTION "clear_stale_slide_text_document"();
