import { Prisma } from "@/generated/prisma/client";
import type { ScriptureNavigationRepository } from "@/application/scripture/navigate-scripture";
import type { ScriptureNavigation } from "@/domain/scripture/navigation";
import {
  requiredTranslations,
  ScriptureSearchError,
  type ScriptureRow,
} from "@/domain/scripture/search";
import { prisma } from "./client";

type RawNavigationRow = {
  approved_translations: string[];
  book_code: string | null;
  book_exists: boolean;
  book_name: string | null;
  chapter_number: number | null;
  current_exists: boolean;
  text: string | null;
  translation_code: string | null;
  verse_number: number | null;
};

export const scriptureNavigationRepository: ScriptureNavigationRepository = {
  async readAdjacent(navigation: ScriptureNavigation) {
    const translations = [...requiredTranslations(navigation.language)];
    const tuplePredicate =
      navigation.direction === "next"
        ? Prisma.sql`(verse."chapter_number", verse."verse_number") > (${navigation.chapter}, ${navigation.verse})`
        : Prisma.sql`(verse."chapter_number", verse."verse_number") < (${navigation.chapter}, ${navigation.verse})`;
    const tupleOrder =
      navigation.direction === "next" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const rows = await prisma.$queryRaw<RawNavigationRow[]>(Prisma.sql`
      WITH requested_book AS (
        SELECT "id", "canonical_code"
        FROM "bible_books"
        WHERE "canonical_code" = ${navigation.book}
      ),
      requested_translations AS (
        SELECT "id", "code"
        FROM "bible_translations"
        WHERE "code" IN (${Prisma.join(translations)})
          AND "rights_status" = 'APPROVED'
      ),
      approved_catalog_translations AS (
        SELECT "id"
        FROM "bible_translations"
        WHERE "code" IN ('JSS3', 'NKJV')
          AND "rights_status" = 'APPROVED'
      ),
      adjacent_location AS (
        SELECT verse."chapter_number", verse."verse_number"
        FROM "bible_verses" AS verse
        JOIN requested_book AS book ON book."id" = verse."book_id"
        WHERE verse."translation_id" IN (
          SELECT "id" FROM approved_catalog_translations
        )
          AND ${tuplePredicate}
        GROUP BY verse."chapter_number", verse."verse_number"
        ORDER BY verse."chapter_number" ${tupleOrder}, verse."verse_number" ${tupleOrder}
        LIMIT 1
      ),
      request_context AS (
        SELECT
          EXISTS (SELECT 1 FROM requested_book) AS book_exists,
          EXISTS (
            SELECT 1
            FROM "bible_verses" AS current_verse
            JOIN requested_book AS current_book
              ON current_book."id" = current_verse."book_id"
            WHERE current_verse."translation_id" IN (
              SELECT "id" FROM approved_catalog_translations
            )
              AND current_verse."chapter_number" = ${navigation.chapter}
              AND current_verse."verse_number" = ${navigation.verse}
          ) AS current_exists,
          ARRAY(
            SELECT "code" FROM requested_translations ORDER BY "code"
          ) AS approved_translations
      )
      SELECT
        request_context.book_exists,
        request_context.current_exists,
        request_context.approved_translations,
        requested_book."canonical_code" AS book_code,
        adjacent_location."chapter_number",
        adjacent_location."verse_number",
        translation."code" AS translation_code,
        verse."text",
        book_name."name" AS book_name
      FROM request_context
      LEFT JOIN requested_book ON TRUE
      LEFT JOIN adjacent_location ON TRUE
      LEFT JOIN "bible_verses" AS verse
        ON verse."book_id" = requested_book."id"
       AND verse."chapter_number" = adjacent_location."chapter_number"
       AND verse."verse_number" = adjacent_location."verse_number"
       AND verse."translation_id" IN (
         SELECT "id" FROM requested_translations
       )
      LEFT JOIN requested_translations AS translation
        ON translation."id" = verse."translation_id"
      LEFT JOIN "bible_book_names" AS book_name
        ON book_name."translation_id" = translation."id"
       AND book_name."book_id" = requested_book."id"
      ORDER BY translation."code"
    `);
    const context = rows[0];
    if (!context) throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
    const resultRows: ScriptureRow[] = rows
      .filter((row) => row.translation_code !== null)
      .map((row) => {
        const translation = row.translation_code;
        if (
          row.book_code === null ||
          row.book_name === null ||
          row.chapter_number === null ||
          row.verse_number === null ||
          row.text === null ||
          (translation !== "JSS3" && translation !== "NKJV")
        )
          throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
        return {
          bookCode: row.book_code,
          bookName: row.book_name,
          chapter: row.chapter_number,
          verse: row.verse_number,
          translation,
          text: row.text,
        };
      });
    return {
      approvedTranslations: context.approved_translations,
      bookExists: context.book_exists,
      currentExists: context.current_exists,
      location:
        context.chapter_number === null || context.verse_number === null
          ? null
          : {
              chapter: context.chapter_number,
              verse: context.verse_number,
            },
      rows: resultRows,
    };
  },
};
