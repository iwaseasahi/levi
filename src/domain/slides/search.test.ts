import { describe, expect, it } from "vitest";
import {
  parseSlideSearch,
  slideSearchPattern,
  slideSearchResult,
  type SlideSummary,
} from "./search";

const id = "00000000-0000-4000-8000-000000000385";
const row: SlideSummary = {
  id,
  title: "Synthetic",
  author: null,
  revision: 1,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};
describe("slide search contract", () => {
  it("normalizes EOL without trimming and folds/escapes ASCII only", () => {
    expect(parseSlideSearch({ q: " A\r\nB\r " })).toEqual({
      mode: "all",
      q: " A\nB\n ",
      cursor: null,
    });
    expect(parseSlideSearch({})).toEqual({ mode: "all", q: "", cursor: null });
    expect(slideSearchPattern("A%_\\ÉＡあ")).toBe("%a\\%\\_\\\\ÉＡあ%");
    expect(parseSlideSearch({ q: "😀".repeat(200) }).q).toHaveLength(400);
  });
  it.each([
    { q: "a".repeat(201) },
    { q: "\0" },
    { q: "\ud800" },
    { q: 1 },
    { churchId: id },
    { mode: "other" },
    { mode: "recent", q: "x" },
    { cursor: "{" },
    { cursor: "x".repeat(3001) },
  ])("rejects invalid search %#", (input) => {
    expect(() => parseSlideSearch(input)).toThrow("INVALID_SLIDE_INPUT");
  });
  it("bounds pages and binds a strict versioned cursor to normalized query", () => {
    const search = parseSlideSearch({ q: "A\rB" });
    const result = slideSearchResult(
      search,
      Array.from({ length: 21 }, () => row),
    );
    expect(result.slides).toHaveLength(20);
    expect(
      parseSlideSearch({ q: "A\nB", cursor: result.nextCursor }),
    ).toMatchObject({
      cursor: { id, q: "A\nB", version: 1, createdAt: row.createdAt },
    });
    expect(() =>
      parseSlideSearch({ q: "Other", cursor: result.nextCursor }),
    ).toThrow();
    expect(() =>
      parseSlideSearch({ mode: "recent", cursor: result.nextCursor }),
    ).toThrow();
    const cursor = JSON.parse(result.nextCursor!);
    for (const patch of [
      { version: 2 },
      { id: "bad" },
      { createdAt: "yesterday" },
      { createdAt: "0000-01-01T00:00:00.000Z" },
      { createdAt: "2026-08-31T00:00:00.0001Z" },
      { churchId: id },
    ])
      expect(() =>
        parseSlideSearch({
          q: "A\nB",
          cursor: JSON.stringify({ ...cursor, ...patch }),
        }),
      ).toThrow();
    const emptyQueryCursor = slideSearchResult(
      parseSlideSearch({}),
      Array.from({ length: 21 }, () => row),
    ).nextCursor;
    expect(() =>
      parseSlideSearch({ mode: "recent", cursor: emptyQueryCursor }),
    ).toThrow();
  });
  it("returns no cursor for recent, empty or final pages", () => {
    expect(
      slideSearchResult(
        parseSlideSearch({ mode: "recent" }),
        Array.from({ length: 12 }, () => row),
      ),
    ).toEqual({
      slides: Array.from({ length: 10 }, () => row),
      nextCursor: null,
    });
    expect(slideSearchResult(parseSlideSearch({}), [])).toEqual({
      slides: [],
      nextCursor: null,
    });
    expect(
      slideSearchResult(parseSlideSearch({}), [row]).nextCursor,
    ).toBeNull();
  });
});
