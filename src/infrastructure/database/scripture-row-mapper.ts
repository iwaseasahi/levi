import {
  ScriptureSearchError,
  type ScriptureRow,
} from "@/domain/scripture/search";

export type RawScriptureContentRow = {
  book_code: string | null;
  book_name: string | null;
  chapter_number: number | null;
  text: string | null;
  translation_code: string | null;
  verse_number: number | null;
};

export function mapRawScriptureRows<T extends RawScriptureContentRow>(
  rows: readonly T[],
  include: (row: T) => boolean,
): ScriptureRow[] {
  return rows.filter(include).map((row) => {
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
}
