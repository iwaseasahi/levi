import { describe, expect, it } from "vitest";
import {
  normalizeSlideEol,
  parseSlideBody,
  parseSlideInput,
  slidePages,
  slideOutline,
  SlideInputError,
} from "./slide";

const input = { title: "Synthetic slide", body: "Synthetic body" };

describe("Slide input", () => {
  it("normalizes EOL and metadata without trimming body or Unicode whitespace", () => {
    expect(
      parseSlideInput({
        title: " \r\n題名\t",
        author: "\t著者\r ",
        body: " \r\n本文\r次\n ",
      }),
    ).toEqual({ title: "題名", author: "著者", body: " \n本文\n次\n " });
    expect(normalizeSlideEol("A\r\nB\rC\nD")).toBe("A\nB\nC\nD");
    expect(
      parseSlideInput({ ...input, title: "\u3000題\u3000", body: "\u00a0" }),
    ).toMatchObject({ title: "\u3000題\u3000", body: "\u00a0" });
  });

  it.each([undefined, null, "", " \t\r\n"])(
    "normalizes absent attribution (case %#)",
    (author) => {
      expect(parseSlideInput({ ...input, author }).author).toBeNull();
    },
  );

  it("counts Unicode code points and preserves maximum-length content", () => {
    const value = {
      title: "😀".repeat(200),
      author: "著".repeat(200),
      body: "😀".repeat(100_000),
    };
    expect(parseSlideInput(value)).toEqual(value);
    expect(parseSlideBody("A".repeat(100_000))).toHaveLength(100_000);
  });

  it.each([
    null,
    [],
    {},
    { ...input, title: "" },
    { ...input, title: " \t\r\n" },
    { ...input, title: "inside\tline" },
    { ...input, title: "two\nlines" },
    { ...input, title: "😀".repeat(201) },
    { ...input, author: "😀".repeat(201) },
    { ...input, author: "two\rlines" },
    { ...input, author: 1 },
    { ...input, body: " \t\r\n" },
    { ...input, body: "😀".repeat(100_001) },
    { ...input, body: "nul\0text" },
    { ...input, title: "bad\0" },
    { ...input, author: "\ud800" },
    { ...input, body: "\udfff" },
    { ...input, title: "\ud800X" },
    { ...input, churchId: "forged-owner" },
    { ...input, revision: 42 },
    { ...input, deletedAt: null },
  ])(
    "rejects malformed, oversized or server-owned input without exposing content (case %#)",
    (value) => {
      expect(() => parseSlideInput(value)).toThrow(SlideInputError);
      expect(() => parseSlideInput(value)).toThrow("INVALID_SLIDE_INPUT");
    },
  );

  it("allows body-only preview while rejecting the same incomplete save", () => {
    expect(slidePages("preview\r\ntext")).toEqual(["preview\ntext"]);
    expect(() => parseSlideInput({ body: "preview\ntext" })).toThrow(
      SlideInputError,
    );
    expect(() => parseSlideBody(42)).toThrow(SlideInputError);
    expect(() => slidePages(" \r\n\t")).toThrow(SlideInputError);
  });
});

describe("Slide pages and outline — pinned Ginmaku golden cases", () => {
  it.each([
    ["A\r\nB\rC", ["A\nB\nC"]],
    ["A\n\n\nB", ["A\n\n\nB"]],
    ["A\n\n\n\nB", ["A", "B"]],
    ["A\n\n\n\n\nB", ["A", "B"]],
    ["A\r\n\r\n\r\n\r\nB", ["A", "B"]],
    ["\n\n\n\nA\n\n\n\n", ["", "A"]],
    ["A\n\n \n\nB", ["A\n\n \n\nB"]],
    ["<script>synthetic</script>\n本文", ["<script>synthetic</script>\n本文"]],
  ] as const)("preserves page text (case %#)", (body, expected) => {
    expect(slidePages(body)).toEqual(expected);
    expect(slidePages(normalizeSlideEol(body))).toEqual(expected);
  });

  it("uses first lines and accessible fallback labels without changing pages", () => {
    const pages = ["", " \t", "First\nSecond\nThird", " 日本語\n本文"];
    expect(slideOutline(pages)).toEqual([
      "Page 1",
      "Page 2",
      "First",
      " 日本語",
    ]);
    expect(pages).toEqual(["", " \t", "First\nSecond\nThird", " 日本語\n本文"]);
    expect(slideOutline([])).toEqual([]);
  });
});
