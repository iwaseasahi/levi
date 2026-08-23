import { Prisma } from "@/generated/prisma/client";
import type { ScriptureNavigationRepository } from "@/application/scripture/navigate-scripture";
import type { ScriptureNavigation } from "@/domain/scripture/navigation";
import {
  requiredTranslations,
  ScriptureSearchError,
} from "@/domain/scripture/search";
import { prisma } from "./client";
import {
  mapRawScriptureRows,
  type RawScriptureContentRow,
} from "./scripture-row-mapper";

type RawNavigationRow = RawScriptureContentRow & {
  available_translations: string[];
  book_exists: boolean;
  current_exists: boolean;
};

export const scriptureNavigationRepository: ScriptureNavigationRepository = {
  async readAdjacent(navigation: ScriptureNavigation) {
    const translations = [...requiredTranslations(navigation.language)];
    const tupleOrder =
      navigation.direction === "next" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const tuplePredicate =
      navigation.direction === "next"
        ? Prisma.sql`book."canonical_order" > current_book."canonical_order" OR (
            book."canonical_order" = current_book."canonical_order"
            AND (verse."chapter_number", verse."verse_number") > (${navigation.chapter}, ${navigation.verse})
          )`
        : Prisma.sql`book."canonical_order" < current_book."canonical_order" OR (
            book."canonical_order" = current_book."canonical_order"
            AND (verse."chapter_number", verse."verse_number") < (${navigation.chapter}, ${navigation.verse})
          )`;
    const bookPredicate =
      navigation.direction === "next"
        ? Prisma.sql`book."canonical_order" >= current_book."canonical_order"`
        : Prisma.sql`book."canonical_order" <= current_book."canonical_order"`;
    const rows = await prisma.$queryRaw<RawNavigationRow[]>(Prisma.sql`
      WITH requested_book AS (
        SELECT "id", "canonical_code", "canonical_order"
        FROM "bible_books"
        WHERE "canonical_code" = ${navigation.book}
      ),
      requested_translations AS (
        SELECT "id", "code"
        FROM "bible_translations"
        WHERE "code" IN (${Prisma.join(translations)})
      ),
      catalog_translations AS (
        SELECT "id"
        FROM "bible_translations"
        WHERE "code" IN ('JSS3', 'NKJV')
      ),
      adjacent_location AS (
        SELECT
          book."id" AS book_id,
          book."canonical_code" AS book_code,
          book."canonical_order" AS book_order,
          location."chapter_number",
          location."verse_number"
        FROM "bible_books" AS book
        CROSS JOIN requested_book AS current_book
        CROSS JOIN LATERAL (
          SELECT verse."chapter_number", verse."verse_number"
          FROM "bible_verses" AS verse
          WHERE verse."book_id" = book."id"
            AND verse."translation_id" IN (
              SELECT "id" FROM catalog_translations
            )
            AND (${tuplePredicate})
          GROUP BY verse."chapter_number", verse."verse_number"
          ORDER BY
            verse."chapter_number" ${tupleOrder},
            verse."verse_number" ${tupleOrder}
          LIMIT 1
        ) AS location
        WHERE ${bookPredicate}
        ORDER BY book."canonical_order" ${tupleOrder}
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
              SELECT "id" FROM catalog_translations
            )
              AND current_verse."chapter_number" = ${navigation.chapter}
              AND current_verse."verse_number" = ${navigation.verse}
          ) AS current_exists,
          ARRAY(
            SELECT "code" FROM requested_translations ORDER BY "code"
          ) AS available_translations
      )
      SELECT
        request_context.book_exists,
        request_context.current_exists,
        request_context.available_translations,
        adjacent_location.book_code,
        adjacent_location."chapter_number",
        adjacent_location."verse_number",
        translation."code" AS translation_code,
        verse."text",
        book_name."name" AS book_name
      FROM request_context
      LEFT JOIN adjacent_location ON TRUE
      LEFT JOIN "bible_verses" AS verse
        ON verse."book_id" = adjacent_location.book_id
       AND verse."chapter_number" = adjacent_location."chapter_number"
       AND verse."verse_number" = adjacent_location."verse_number"
       AND verse."translation_id" IN (
         SELECT "id" FROM requested_translations
       )
      LEFT JOIN requested_translations AS translation
        ON translation."id" = verse."translation_id"
      LEFT JOIN "bible_book_names" AS book_name
        ON book_name."translation_id" = translation."id"
       AND book_name."book_id" = adjacent_location.book_id
      ORDER BY translation."code"
    `);
    const context = rows[0];
    if (!context) throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
    const resultRows = mapRawScriptureRows(
      rows,
      (row) => row.translation_code !== null,
    );
    return {
      availableTranslations: context.available_translations,
      bookExists: context.book_exists,
      currentExists: context.current_exists,
      location:
        context.book_code === null ||
        context.chapter_number === null ||
        context.verse_number === null
          ? null
          : {
              book: context.book_code,
              chapter: context.chapter_number,
              verse: context.verse_number,
            },
      rows: resultRows,
    };
  },
};
