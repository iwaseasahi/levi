import { describe, expect, it } from "vitest";

import {
  assembleScriptureSearchItems,
  parseScriptureSearch,
  ScriptureSearchError,
  type ScriptureRow,
  type ScriptureSearch,
} from "./search";

const search: ScriptureSearch = {
  book: "JHN",
  chapter: 3,
  startVerse: 16,
  endVerse: 17,
  language: "both",
};

function row(verse: number, translation: "JSS3" | "NKJV"): ScriptureRow {
  return {
    bookCode: "JHN",
    bookName: translation === "JSS3" ? "架空書" : "Synthetic Book",
    chapter: 3,
    verse,
    translation,
    text: `${translation} synthetic ${verse}`,
  };
}

describe("scripture search domain", () => {
  it("parses one strict inclusive range including verse zero", () => {
    expect(
      parseScriptureSearch(
        new URLSearchParams({
          book: "PSA",
          chapter: "1",
          startVerse: "0",
          endVerse: "2",
          language: "ja",
        }),
      ),
    ).toEqual({
      book: "PSA",
      chapter: 1,
      startVerse: 0,
      endVerse: 2,
      language: "ja",
    });
  });

  it.each([
    "book=JHN&chapter=3&startVerse=16&language=both",
    "book=JHN&chapter=3&startVerse=16&endVerse=18&language=both&extra=1",
    "book=JHN&book=ROM&chapter=3&startVerse=16&endVerse=18&language=both",
    "book=jhn&chapter=3&startVerse=16&endVerse=18&language=both",
    "book=JHN&chapter=1e1&startVerse=16&endVerse=18&language=both",
    "book=JHN&chapter=3&startVerse=%2016&endVerse=18&language=both",
    "book=PSA&chapter=1&startVerse=0&endVerse=500&language=ja",
  ])("rejects invalid input: %s", (query) => {
    expect(() => parseScriptureSearch(new URLSearchParams(query))).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "INVALID_SEARCH_INPUT",
      }),
    );
  });

  it("distinguishes a reversed inclusive range", () => {
    expect(() =>
      parseScriptureSearch(
        new URLSearchParams(
          "book=JHN&chapter=3&startVerse=18&endVerse=16&language=both",
        ),
      ),
    ).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "INVALID_VERSE_RANGE",
      }),
    );
  });

  it("pairs bilingual rows by canonical location in verse order", () => {
    expect(
      assembleScriptureSearchItems(search, [
        row(17, "NKJV"),
        row(16, "JSS3"),
        row(17, "JSS3"),
        row(16, "NKJV"),
      ]),
    ).toEqual([
      {
        location: { book: "JHN", chapter: 3, verse: 16 },
        texts: {
          japanese: expect.objectContaining({ translation: "JSS3" }),
          english: expect.objectContaining({ translation: "NKJV" }),
        },
      },
      {
        location: { book: "JHN", chapter: 3, verse: 17 },
        texts: {
          japanese: expect.objectContaining({ translation: "JSS3" }),
          english: expect.objectContaining({ translation: "NKJV" }),
        },
      },
    ]);
  });

  it("returns an explicit translation error for a missing paired translation", () => {
    expect(() =>
      assembleScriptureSearchItems(search, [
        row(16, "JSS3"),
        row(16, "NKJV"),
        row(17, "JSS3"),
      ]),
    ).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "TRANSLATION_NOT_AVAILABLE",
      }),
    );
  });

  it("returns an explicit range error for a wholly missing verse", () => {
    expect(() =>
      assembleScriptureSearchItems(search, [row(16, "JSS3"), row(16, "NKJV")]),
    ).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "VERSE_RANGE_NOT_FOUND",
      }),
    );
  });

  it("rejects duplicate or out-of-contract repository rows", () => {
    expect(() =>
      assembleScriptureSearchItems({ ...search, endVerse: 16 }, [
        row(16, "JSS3"),
        row(16, "JSS3"),
        row(16, "NKJV"),
      ]),
    ).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "CATALOG_INTEGRITY_ERROR",
      }),
    );
  });
});
