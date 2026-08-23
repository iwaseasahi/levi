ALTER TABLE "bible_translations"
    DROP CONSTRAINT "bible_translations_rights_ck",
    DROP COLUMN "rights_status";

DROP TYPE "bible_rights_status";
