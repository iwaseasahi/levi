-- Product scope no longer stores Slide attribution. Existing author values are
-- intentionally discarded when this forward migration removes the column.
ALTER TABLE "slides" DROP CONSTRAINT IF EXISTS "slides_author_valid";
ALTER TABLE "slides" DROP COLUMN "author";
