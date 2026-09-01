import { describe, expect, it } from "vitest";
import {
  parseSlideListQuery,
  slideListResult,
  type SlideSummary,
} from "./list";

const id = "00000000-0000-4000-8000-000000000385";
const row: SlideSummary = {
  id,
  title: "Synthetic",
  revision: 1,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

describe("slide list contract", () => {
  it("accepts an empty query", () => {
    expect(parseSlideListQuery({})).toEqual({ cursor: null });
  });

  it.each([
    { q: "body" },
    { mode: "all" },
    { mode: "recent" },
    { churchId: id },
    { cursor: "{" },
    { cursor: "x".repeat(3001) },
  ])("rejects removed, unknown or invalid input %#", (input) => {
    expect(() => parseSlideListQuery(input)).toThrow("INVALID_SLIDE_INPUT");
  });

  it("bounds pages and accepts only a strict versioned position cursor", () => {
    const result = slideListResult(
      parseSlideListQuery({}),
      Array.from({ length: 21 }, () => row),
    );
    expect(result.slides).toHaveLength(20);
    expect(parseSlideListQuery({ cursor: result.nextCursor })).toEqual({
      cursor: { version: 1, createdAt: row.createdAt, id },
    });
    const cursor = JSON.parse(result.nextCursor!);
    for (const patch of [
      { version: 2 },
      { id: "bad" },
      { createdAt: "yesterday" },
      { createdAt: "0000-01-01T00:00:00.000Z" },
      { createdAt: "2026-08-31T00:00:00.0001Z" },
      { churchId: id },
      { q: "body" },
    ])
      expect(() =>
        parseSlideListQuery({
          cursor: JSON.stringify({ ...cursor, ...patch }),
        }),
      ).toThrow();
  });

  it("returns no cursor for empty and final pages", () => {
    expect(slideListResult(parseSlideListQuery({}), [])).toEqual({
      slides: [],
      nextCursor: null,
    });
    expect(
      slideListResult(parseSlideListQuery({}), [row]).nextCursor,
    ).toBeNull();
  });
});
