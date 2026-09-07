import { describe, expect, it } from "vitest";
import {
  normalizeSlideEol,
  parseSlideInput,
  parseSlideVerticalAlignment,
  SlideInputError,
} from "./slide";
import { slideTextDocumentFromPlainText } from "./text-document";

const input = {
  title: "Synthetic slide",
  document: slideTextDocumentFromPlainText("Synthetic text"),
};

describe("Slide input", () => {
  it("normalizes the title and keeps the validated document as the only text value", () => {
    const document = slideTextDocumentFromPlainText(" \n本文\n次\n ");
    expect(
      parseSlideInput({
        title: " \r\n題名\t",
        document,
      }),
    ).toEqual({ title: "題名", document, verticalAlignment: "center" });
    expect(normalizeSlideEol("A\r\nB\rC\nD")).toBe("A\nB\nC\nD");
    expect(
      parseSlideInput({
        ...input,
        title: "\u3000題\u3000",
        document: slideTextDocumentFromPlainText("\u00a0"),
      }),
    ).toMatchObject({ title: "\u3000題\u3000" });
  });

  it("counts Unicode code points and preserves maximum-length content", () => {
    const document = slideTextDocumentFromPlainText("😀".repeat(100_000));
    const value = { title: "😀".repeat(200), document };
    expect(parseSlideInput(value)).toEqual({
      ...value,
      verticalAlignment: "center",
    });
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
    { ...input, body: "legacy text" },
    { title: input.title, body: "legacy text" },
    { ...input, churchId: "forged-owner" },
    { ...input, title: "bad\0" },
    { ...input, title: "\ud800X" },
    { ...input, revision: 42 },
    { ...input, deletedAt: null },
  ])(
    "rejects compatibility, malformed or server-owned input without exposing content (case %#)",
    (value) => {
      expect(() => parseSlideInput(value)).toThrow(SlideInputError);
      expect(() => parseSlideInput(value)).toThrow("INVALID_SLIDE_INPUT");
    },
  );

  it("accepts a strict rich document without adding a flattened compatibility field", () => {
    const document = {
      version: 2 as const,
      blocks: [
        {
          type: "paragraph" as const,
          alignment: "left" as const,
          content: [
            {
              type: "text" as const,
              text: "Big",
              size: 200 as const,
              marks: [],
            },
            { type: "break" as const },
            {
              type: "text" as const,
              text: "Small",
              size: 50 as const,
              marks: [],
            },
          ],
        },
      ],
    };
    expect(parseSlideInput({ title: "Rich", document })).toEqual({
      title: "Rich",
      document,
      verticalAlignment: "center",
    });
    expect(parseSlideInput({ title: "Rich", document })).not.toHaveProperty(
      "body",
    );
  });

  it.each(["top", "center", "bottom"] as const)(
    "accepts and preserves the %s whole-body alignment",
    (verticalAlignment) => {
      expect(
        parseSlideInput({ ...input, verticalAlignment }).verticalAlignment,
      ).toBe(verticalAlignment);
      expect(parseSlideVerticalAlignment(verticalAlignment)).toBe(
        verticalAlignment,
      );
    },
  );

  it.each(["start", "end", "TOP", "4px", null, 1])(
    "rejects unsupported whole-body alignment %#",
    (verticalAlignment) => {
      expect(() => parseSlideInput({ ...input, verticalAlignment })).toThrow(
        SlideInputError,
      );
      expect(() => parseSlideVerticalAlignment(verticalAlignment)).toThrow(
        SlideInputError,
      );
    },
  );
});
