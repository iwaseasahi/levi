import { describe, expect, it } from "vitest";
import { ScriptureSearchError, type ScriptureRow } from "./search";
import { assembleNavigatedItem, parseScriptureNavigation } from "./navigation";

describe("scripture navigation domain", () => {
  it.each([
    ["previous", 0],
    ["next", 31],
  ] as const)(
    "parses strict %s navigation including verse %s",
    (direction, verse) => {
      expect(
        parseScriptureNavigation(
          new URLSearchParams({
            book: "GEN",
            chapter: "1",
            verse: String(verse),
            direction,
            language: "both",
          }),
        ),
      ).toEqual({
        book: "GEN",
        chapter: 1,
        verse,
        direction,
        language: "both",
      });
    },
  );

  it.each([
    "book=GEN&chapter=1&verse=1&direction=next",
    "book=GEN&chapter=1&verse=1&direction=sideways&language=both",
    "book=GEN&chapter=1&verse=1&direction=next&language=both&extra=1",
    "book=GEN&chapter=1&verse=1&verse=2&direction=next&language=both",
  ])("rejects invalid navigation: %s", (query) => {
    expect(() => parseScriptureNavigation(new URLSearchParams(query))).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "INVALID_SEARCH_INPUT",
      }),
    );
  });

  it("pairs both translations at the resolved canonical location", () => {
    const rows: ScriptureRow[] = [
      {
        bookCode: "GEN",
        bookName: "Genesis",
        chapter: 2,
        verse: 1,
        translation: "NKJV",
        text: "English test text",
      },
      {
        bookCode: "GEN",
        bookName: "創世記",
        chapter: 2,
        verse: 1,
        translation: "JSS3",
        text: "日本語テスト本文",
      },
    ];
    expect(
      assembleNavigatedItem(
        {
          book: "GEN",
          chapter: 1,
          verse: 31,
          direction: "next",
          language: "both",
        },
        { book: "GEN", chapter: 2, verse: 1 },
        rows,
      ).location,
    ).toEqual({ book: "GEN", chapter: 2, verse: 1 });
  });

  it("reports a requested translation missing at an existing location", () => {
    expect(() =>
      assembleNavigatedItem(
        {
          book: "GEN",
          chapter: 1,
          verse: 31,
          direction: "next",
          language: "ja",
        },
        { book: "GEN", chapter: 2, verse: 1 },
        [],
      ),
    ).toThrow(
      expect.objectContaining<Partial<ScriptureSearchError>>({
        code: "TRANSLATION_NOT_AVAILABLE",
      }),
    );
  });

  it("assembles a location in the adjacent canonical book", () => {
    const item = assembleNavigatedItem(
      {
        book: "MAL",
        chapter: 4,
        verse: 6,
        direction: "next",
        language: "en",
      },
      { book: "MAT", chapter: 1, verse: 1 },
      [
        {
          bookCode: "MAT",
          bookName: "Matthew",
          chapter: 1,
          verse: 1,
          translation: "NKJV",
          text: "Test text",
        },
      ],
    );
    expect(item.location).toEqual({ book: "MAT", chapter: 1, verse: 1 });
  });
});
