import { describe, expect, it } from "vitest";
import { ScriptureSearchError } from "@/domain/scripture/search";
import {
  mapRawScriptureRows,
  type RawScriptureContentRow,
} from "./scripture-row-mapper";

const contentRow: RawScriptureContentRow = {
  book_code: "GEN",
  book_name: "Synthetic Genesis",
  chapter_number: 1,
  text: "Synthetic text",
  translation_code: "NKJV",
  verse_number: 1,
};

describe("scripture raw row mapper", () => {
  it("maps included database content and omits an outer-join placeholder", () => {
    expect(
      mapRawScriptureRows(
        [contentRow, { ...contentRow, verse_number: null }],
        (row) => row.verse_number !== null,
      ),
    ).toEqual([
      {
        bookCode: "GEN",
        bookName: "Synthetic Genesis",
        chapter: 1,
        text: "Synthetic text",
        translation: "NKJV",
        verse: 1,
      },
    ]);
  });

  it("rejects a partially populated or unknown-translation row", () => {
    for (const row of [
      { ...contentRow, book_name: null },
      { ...contentRow, translation_code: "UNKNOWN" },
    ]) {
      expect(() => mapRawScriptureRows([row], () => true)).toThrow(
        expect.objectContaining<Partial<ScriptureSearchError>>({
          code: "CATALOG_INTEGRITY_ERROR",
        }),
      );
    }
  });
});
