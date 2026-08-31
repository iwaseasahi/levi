import { describe, expect, it } from "vitest";
import {
  scriptureSearchLink,
  scriptureSelectionFromQuery,
} from "./scripture-search-link";
import { initialScriptureSelection } from "./scripture-search-selection";

const query = { book: "GEN", chapter: "1", startVerse: "0", language: "both" };

describe("Scripture links from the slide sidebar", () => {
  it.each([null, 3])(
    "preserves an omitted or explicit end verse (%s)",
    (endVerse) => {
      const url = new URL(
        scriptureSearchLink({
          book: "GEN",
          chapter: 1,
          startVerse: 0,
          endVerse,
          language: "both",
        }),
        "https://levi.invalid",
      );
      expect(url.pathname).toBe("/scripture");
      expect(
        scriptureSelectionFromQuery(Object.fromEntries(url.searchParams)),
      ).toEqual({
        ...query,
        endVerse: endVerse === null ? "" : String(endVerse),
      });
    },
  );

  it.each([
    {},
    { ...query, book: ["GEN", "EXO"] },
    { ...query, chapter: "-1" },
    { ...query, chapter: "32768" },
    { ...query, startVerse: "1x" },
    { ...query, startVerse: "2", endVerse: "1" },
    { ...query, endVerse: "500" },
    { ...query, endVerse: "" },
    { ...query, language: "unknown" },
    { ...query, book: "<script>" },
    { ...query, extra: "unexpected" },
  ])("ignores malformed query input: %j", (input) => {
    expect(scriptureSelectionFromQuery(input)).toEqual(
      initialScriptureSelection,
    );
  });
});
