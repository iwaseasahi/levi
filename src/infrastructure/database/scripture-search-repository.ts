import { Prisma } from "@/generated/prisma/client";
import type { ScriptureSearchRepository } from "@/application/scripture/search-scripture";
import {
  requiredTranslations,
  ScriptureSearchError,
  type ScriptureRow,
  type ScriptureSearch,
} from "@/domain/scripture/search";
import { prisma } from "./client";

type RawScriptureRow = {
  approved_translations: string[];
  book_exists: boolean;
  book_code: string | null;
  book_name: string | null;
  chapter_exists: boolean;
  chapter_translations: string[];
  chapter_number: number | null;
  text: string | null;
  translation_code: string | null;
  verse_number: number | null;
};

export const scriptureSearchRepository: ScriptureSearchRepository = {
  async readRange(search: ScriptureSearch) {
    const translations = [...requiredTranslations(search.language)];
    const rows = await prisma.$queryRaw<RawScriptureRow[]>(Prisma.sql`
      WITH requested_book AS (
        SELECT "id", "canonical_code"
        FROM "bible_books"
        WHERE "canonical_code" = ${search.book}
      ),
      requested_translations AS (
        SELECT "id", "code"
        FROM "bible_translations"
        WHERE "code" IN (${Prisma.join(translations)})
          AND "rights_status" = 'APPROVED'
      ),
      approved_catalog_translations AS (
        SELECT "id", "code"
        FROM "bible_translations"
        WHERE "code" IN ('JSS3', 'NKJV')
          AND "rights_status" = 'APPROVED'
      ),
      request_context AS (
        SELECT
          EXISTS (SELECT 1 FROM requested_book) AS book_exists,
          EXISTS (
            SELECT 1
            FROM "bible_verses" AS chapter_verse
            JOIN requested_book AS chapter_book
              ON chapter_book."id" = chapter_verse."book_id"
            WHERE chapter_verse."chapter_number" = ${search.chapter}
              AND chapter_verse."translation_id" IN (
                SELECT "id" FROM approved_catalog_translations
              )
          ) AS chapter_exists,
          ARRAY(
            SELECT "code" FROM requested_translations ORDER BY "code"
          ) AS approved_translations,
          ARRAY(
            SELECT catalog_translation."code"
            FROM approved_catalog_translations AS catalog_translation
            WHERE EXISTS (
              SELECT 1
              FROM "bible_verses" AS translated_chapter
              JOIN requested_book AS translated_book
                ON translated_book."id" = translated_chapter."book_id"
              WHERE translated_chapter."translation_id" = catalog_translation."id"
                AND translated_chapter."chapter_number" = ${search.chapter}
            )
            ORDER BY catalog_translation."code"
          ) AS chapter_translations
      )
      SELECT
        request_context.book_exists,
        request_context.chapter_exists,
        request_context.approved_translations,
        request_context.chapter_translations,
        requested_book."canonical_code" AS book_code,
        verse."chapter_number",
        verse."verse_number",
        verse."text",
        translation."code" AS translation_code,
        book_name."name" AS book_name
      FROM request_context
      LEFT JOIN requested_book ON TRUE
      LEFT JOIN "bible_verses" AS verse
        ON verse."book_id" = requested_book."id"
       AND verse."chapter_number" = ${search.chapter}
       AND verse."verse_number" BETWEEN ${search.startVerse} AND ${search.endVerse}
       AND verse."translation_id" IN (
         SELECT "id" FROM requested_translations
       )
      LEFT JOIN requested_translations AS translation
        ON translation."id" = verse."translation_id"
      LEFT JOIN "bible_book_names" AS book_name
        ON book_name."translation_id" = translation."id"
       AND book_name."book_id" = requested_book."id"
      ORDER BY verse."verse_number" ASC, translation."code" ASC
    `);
    const context = rows[0];
    if (!context) throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
    const resultRows: ScriptureRow[] = rows
      .filter((row) => row.verse_number !== null)
      .map((row): ScriptureRow => {
        const translation = row.translation_code;
        if (
          row.book_code === null ||
          row.book_name === null ||
          row.chapter_number === null ||
          row.text === null ||
          (translation !== "JSS3" && translation !== "NKJV")
        )
          throw new ScriptureSearchError("CATALOG_INTEGRITY_ERROR");
        return {
          bookCode: row.book_code,
          bookName: row.book_name,
          chapter: row.chapter_number,
          verse: row.verse_number!,
          translation,
          text: row.text,
        };
      });
    return {
      approvedTranslations: context.approved_translations,
      bookExists: context.book_exists,
      chapterExists: context.chapter_exists,
      chapterTranslations: context.chapter_translations,
      rows: resultRows,
    };
  },
};
