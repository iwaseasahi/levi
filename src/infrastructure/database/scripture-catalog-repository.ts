import { Prisma } from "@/generated/prisma/client";
import type { ScriptureCatalogRepository } from "@/application/scripture/read-scripture-catalog";
import {
  requiredTranslations,
  type ScriptureCatalogQuery,
} from "@/domain/scripture/search";
import { prisma } from "./client";

type RawCatalogRow = {
  book_code: string;
  book_name: string;
  chapters: number[];
  verses: number[];
};

export const scriptureCatalogRepository: ScriptureCatalogRepository = {
  async read(query: ScriptureCatalogQuery) {
    const translations = [...requiredTranslations(query.language)];
    const preferredTranslation = query.language === "en" ? "NKJV" : "JSS3";
    const selectedBook = query.book ?? null;
    const selectedChapter = query.chapter ?? null;
    const rows = await prisma.$queryRaw<RawCatalogRow[]>(Prisma.sql`
      WITH requested_translations AS (
        SELECT "id", "code"
        FROM "bible_translations"
        WHERE "code" IN (${Prisma.join(translations)})
          AND "rights_status" = 'APPROVED'
      ),
      eligible_locations AS (
        SELECT
          verse."book_id",
          verse."chapter_number",
          verse."verse_number"
        FROM "bible_verses" AS verse
        JOIN requested_translations AS translation
          ON translation."id" = verse."translation_id"
        GROUP BY verse."book_id", verse."chapter_number", verse."verse_number"
        HAVING COUNT(DISTINCT translation."code") = ${translations.length}
      )
      SELECT
        book."canonical_code" AS book_code,
        book_name."name" AS book_name,
        CASE WHEN book."canonical_code" = ${selectedBook}
          THEN ARRAY(
            SELECT DISTINCT location."chapter_number"
            FROM eligible_locations AS location
            WHERE location."book_id" = book."id"
            ORDER BY location."chapter_number"
          )
          ELSE ARRAY[]::smallint[]
        END AS chapters,
        CASE WHEN book."canonical_code" = ${selectedBook}
                    AND ${selectedChapter}::smallint IS NOT NULL
          THEN ARRAY(
            SELECT DISTINCT location."verse_number"
            FROM eligible_locations AS location
            WHERE location."book_id" = book."id"
              AND location."chapter_number" = ${selectedChapter}::smallint
            ORDER BY location."verse_number"
          )
          ELSE ARRAY[]::smallint[]
        END AS verses
      FROM "bible_books" AS book
      JOIN "bible_translations" AS preferred_translation
        ON preferred_translation."code" = ${preferredTranslation}
       AND preferred_translation."rights_status" = 'APPROVED'
      JOIN "bible_book_names" AS book_name
        ON book_name."book_id" = book."id"
       AND book_name."translation_id" = preferred_translation."id"
      WHERE EXISTS (
        SELECT 1 FROM eligible_locations AS location
        WHERE location."book_id" = book."id"
      )
      ORDER BY book."canonical_order"
    `);
    const selected = rows.find((row) => row.book_code === query.book);
    return {
      books: rows.map((row) => ({ code: row.book_code, name: row.book_name })),
      chapters: selected?.chapters ?? [],
      verses: selected?.verses ?? [],
    };
  },
};
