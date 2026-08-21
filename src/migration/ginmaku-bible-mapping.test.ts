import { describe, expect, it } from "vitest";
import {
  GINMAKU_BOOK_MAPPING,
  GINMAKU_TRANSLATION_MAPPING,
} from "./ginmaku-bible-mapping";

describe("Ginmaku Bible mapping", () => {
  it("maps the profiled 39/27 canonical sequence without legacy row IDs", () => {
    expect(GINMAKU_TRANSLATION_MAPPING).toEqual({ 1: "JSS3", 2: "NKJV" });
    expect(GINMAKU_BOOK_MAPPING).toHaveLength(66);
    expect(
      GINMAKU_BOOK_MAPPING.filter(({ testament }) => testament === "OLD"),
    ).toHaveLength(39);
    expect(
      GINMAKU_BOOK_MAPPING.filter(({ testament }) => testament === "NEW"),
    ).toHaveLength(27);
    expect(
      GINMAKU_BOOK_MAPPING.map(({ legacyBookNameId }) => legacyBookNameId),
    ).toEqual(Array.from({ length: 66 }, (_, index) => index + 1));
    expect(
      new Set(GINMAKU_BOOK_MAPPING.map(({ canonicalCode }) => canonicalCode)),
    ).toHaveProperty("size", 66);
  });
});
