import { describe, expect, it } from "vitest";
import {
  normalizeSlideEol,
  parseSlideBody,
  parseSlideInput,
  SlideInputError,
} from "./slide";

const input = { title: "Synthetic slide", body: "Synthetic body" };

describe("Slide input", () => {
  it("normalizes EOL and title without trimming body or Unicode whitespace", () => {
    expect(
      parseSlideInput({
        title: " \r\n題名\t",
        body: " \r\n本文\r次\n ",
      }),
    ).toMatchObject({ title: "題名", body: " \n本文\n次\n " });
    expect(normalizeSlideEol("A\r\nB\rC\nD")).toBe("A\nB\nC\nD");
    expect(
      parseSlideInput({ ...input, title: "\u3000題\u3000", body: "\u00a0" }),
    ).toMatchObject({ title: "\u3000題\u3000", body: "\u00a0" });
  });

  it("counts Unicode code points and preserves maximum-length content", () => {
    const value = {
      title: "😀".repeat(200),
      body: "😀".repeat(100_000),
    };
    expect(parseSlideInput(value)).toMatchObject(value);
    expect(parseSlideInput(value).document).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [{ type: "text", text: value.body, size: 100, marks: [] }],
        },
      ],
    });
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
    { ...input, author: "legacy attribution" },
    { ...input, body: " \t\r\n" },
    { ...input, body: "😀".repeat(100_001) },
    { ...input, body: "nul\0text" },
    { ...input, title: "bad\0" },
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
    expect(parseSlideBody("preview\r\ntext")).toBe("preview\ntext");
    expect(() => parseSlideInput({ body: "preview\ntext" })).toThrow(
      SlideInputError,
    );
    expect(() => parseSlideBody(42)).toThrow(SlideInputError);
    expect(() => parseSlideBody(" \r\n\t")).toThrow(SlideInputError);
  });

  it("accepts a strict rich document and derives the compatibility body", () => {
    expect(
      parseSlideInput({
        title: "Rich",
        document: {
          version: 2,
          blocks: [
            {
              type: "paragraph",
              alignment: "left",
              content: [
                { type: "text", text: "Big", size: 220, marks: [] },
                { type: "break" },
                { type: "text", text: "Small", size: 60, marks: [] },
              ],
            },
          ],
        },
      }),
    ).toEqual({
      title: "Rich",
      body: "Big\nSmall",
      document: {
        version: 2,
        blocks: [
          {
            type: "paragraph",
            alignment: "left",
            content: [
              { type: "text", text: "Big", size: 220, marks: [] },
              { type: "break" },
              { type: "text", text: "Small", size: 60, marks: [] },
            ],
          },
        ],
      },
    });
  });
});

describe("Slide body — single-page replacement contract", () => {
  it("preserves consecutive newlines as content instead of splitting pages", () => {
    const body = "A\r\n\r\n\r\n\r\nB\n\n\n\n\nC";
    expect(parseSlideBody(body)).toBe("A\n\n\n\nB\n\n\n\n\nC");
  });
});
