import { describe, expect, it } from "vitest";

import {
  contiguousEndVerses,
  initialScriptureSelection,
  normalizeScriptureFavorite,
  normalizeScriptureNumberInput,
  normalizeScriptureSearch,
  scriptureCatalogUrl,
  scriptureFavoriteTitle,
} from "./scripture-search-selection";

const book = {
  code: "JHN",
  englishName: "John",
  japaneseName: "ヨハネ",
  name: "ヨハネ",
};

describe("scripture search selection", () => {
  it("normalizes full-width numeric input and removes non-numeric characters", () => {
    expect(normalizeScriptureNumberInput("１２３")).toBe("123");
    expect(normalizeScriptureNumberInput("1２a-３")).toBe("123");
    expect(normalizeScriptureNumberInput("ＡＢＣ")).toBe("");
  });

  it("builds the catalog request from the current selection", () => {
    expect(scriptureCatalogUrl(initialScriptureSelection)).toBe(
      "/api/scripture/catalog?language=both",
    );
    expect(
      scriptureCatalogUrl({ book: "JHN", chapter: "3", language: "ja" }),
    ).toBe("/api/scripture/catalog?language=ja&book=JHN&chapter=3");
  });

  it("limits an omitted end verse to the contiguous range", () => {
    expect(contiguousEndVerses([15, 16, 17, 19], "16")).toEqual([16, 17]);
    expect(
      normalizeScriptureSearch(
        {
          book: "JHN",
          chapter: "3",
          endVerse: "",
          language: "both",
          startVerse: "16",
        },
        [3],
        [15, 16, 17, 19],
      ),
    ).toEqual({
      book: "JHN",
      chapter: 3,
      endVerse: 17,
      language: "both",
      startVerse: 16,
    });
  });

  it("rejects incomplete or non-contiguous selections", () => {
    expect(
      normalizeScriptureSearch(initialScriptureSelection, [], []),
    ).toBeNull();
    expect(
      normalizeScriptureSearch(
        {
          book: "JHN",
          chapter: "3",
          endVerse: "19",
          language: "both",
          startVerse: "16",
        },
        [3],
        [16, 17, 19],
      ),
    ).toBeNull();
  });

  it("preserves an omitted favorite end verse", () => {
    const selection = {
      book: "JHN",
      chapter: "3",
      endVerse: "",
      language: "both" as const,
      startVerse: "16",
    };
    const search = normalizeScriptureSearch(selection, [3], [16, 17]);
    expect(normalizeScriptureFavorite(selection, search)).toEqual({
      book: "JHN",
      chapter: 3,
      endVerse: null,
      language: "both",
      startVerse: 16,
    });
    expect(scriptureFavoriteTitle(selection, [book])).toBe("ヨハネ/John 3:16");
  });

  it("keeps an explicitly selected favorite range", () => {
    const selection = {
      book: "JHN",
      chapter: "3",
      endVerse: "17",
      language: "both" as const,
      startVerse: "16",
    };
    const search = normalizeScriptureSearch(selection, [3], [16, 17]);
    expect(normalizeScriptureFavorite(selection, search)).toEqual(search);
    expect(scriptureFavoriteTitle(selection, [book])).toBe(
      "ヨハネ/John 3:16-17",
    );
  });
});
