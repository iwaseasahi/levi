import { describe, expect, it } from "vitest";
import {
  hasExactQueryMultiplicity,
  nonNegativeSmallIntSchema,
  positiveSmallIntSchema,
  scriptureBookCodeSchema,
} from "./identifiers";

describe("scripture identifiers", () => {
  it("accepts canonical identifiers and PostgreSQL smallint bounds", () => {
    expect(scriptureBookCodeSchema.parse("1_JHN-ALT")).toBe("1_JHN-ALT");
    expect(positiveSmallIntSchema.parse("32767")).toBe(32767);
    expect(nonNegativeSmallIntSchema.parse("0")).toBe(0);
  });

  it.each([
    [scriptureBookCodeSchema, "jhn"],
    [scriptureBookCodeSchema, "A2345678901234567"],
    [positiveSmallIntSchema, "0"],
    [positiveSmallIntSchema, "32768"],
    [nonNegativeSmallIntSchema, "-1"],
    [nonNegativeSmallIntSchema, "01"],
  ])("rejects an out-of-contract identifier", (schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("enforces required, optional, duplicate, and unknown query keys", () => {
    const shape = { required: ["language"], optional: ["book", "chapter"] };
    expect(
      hasExactQueryMultiplicity(
        new URLSearchParams("language=both&book=GEN"),
        shape,
      ),
    ).toBe(true);
    expect(
      hasExactQueryMultiplicity(new URLSearchParams("book=GEN"), shape),
    ).toBe(false);
    expect(
      hasExactQueryMultiplicity(
        new URLSearchParams("language=both&book=GEN&book=EXO"),
        shape,
      ),
    ).toBe(false);
    expect(
      hasExactQueryMultiplicity(
        new URLSearchParams("language=both&extra=1"),
        shape,
      ),
    ).toBe(false);
  });
});
