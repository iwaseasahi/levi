-- Enforce the one-surface invariant at commit while allowing the application to
-- create/delete the child and change Slide type within one transaction.
CREATE FUNCTION "enforce_slide_image_total"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_slide_id UUID;
  target_content_type "slide_content_type";
  image_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'slides' THEN
    target_slide_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_slide_id := COALESCE(NEW."slide_id", OLD."slide_id");
  END IF;

  SELECT "content_type" INTO target_content_type
  FROM "slides" WHERE "id" = target_slide_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO image_count
  FROM "slide_images" WHERE "slide_id" = target_slide_id;
  IF (target_content_type = 'IMAGE' AND image_count <> 1)
    OR (target_content_type = 'TEXT' AND image_count <> 0) THEN
    RAISE EXCEPTION 'slide % must have exactly its selected content type', target_slide_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "slides_image_total_ck"
AFTER INSERT OR UPDATE OR DELETE ON "slides"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_slide_image_total"();

CREATE CONSTRAINT TRIGGER "slide_images_total_ck"
AFTER INSERT OR UPDATE OR DELETE ON "slide_images"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_slide_image_total"();
