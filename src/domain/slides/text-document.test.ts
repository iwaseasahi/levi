import { describe, expect, it } from "vitest";
import { SlideInputError } from "./boundary";
import {
  flattenSlideTextDocument,
  parseSlideTextDocument,
  slideTextDocumentFromPlainText,
  slideTextDocumentNodeLimit,
} from "./text-document";

describe("SlideTextDocumentV1", () => {
  it("round-trips leading, trailing and repeated LF exactly", () => {
    const body = "\n一行目\n\nSecond\n";
    const document = slideTextDocumentFromPlainText(body);
    expect(flattenSlideTextDocument(document)).toBe(body);
    expect(document.nodes).toContainEqual({
      type: "text",
      text: "一行目",
      size: "normal",
    });
  });

  it("normalizes adjacent runs of the same size without crossing breaks", () => {
    expect(
      parseSlideTextDocument({
        version: 1,
        nodes: [
          { type: "text", text: "A", size: "large" },
          { type: "text", text: "B", size: "large" },
          { type: "break" },
          { type: "text", text: "C", size: "large" },
        ],
      }),
    ).toEqual({
      version: 1,
      nodes: [
        { type: "text", text: "AB", size: "large" },
        { type: "break" },
        { type: "text", text: "C", size: "large" },
      ],
    });
  });

  it.each([
    null,
    {},
    { version: 2, nodes: [] },
    { version: 1, nodes: [], extra: true },
    { version: 1, nodes: [{ type: "break", extra: true }] },
    { version: 1, nodes: [{ type: "text", text: "A", size: "huge" }] },
    { version: 1, nodes: [{ type: "text", text: "A\nB", size: "normal" }] },
    { version: 1, nodes: [{ type: "text", text: "\0", size: "normal" }] },
    { version: 1, nodes: [{ type: "text", text: "\ud800", size: "normal" }] },
    { version: 1, nodes: [{ type: "break" }] },
    {
      version: 1,
      nodes: Array.from({ length: slideTextDocumentNodeLimit + 1 }, () => ({
        type: "break",
      })),
    },
  ])("rejects invalid or unbounded input", (value) => {
    expect(() => parseSlideTextDocument(value)).toThrow(SlideInputError);
  });

  it("allows four selected-range size tokens and rejects overlong text", () => {
    const document = parseSlideTextDocument({
      version: 1,
      nodes: [
        { type: "text", text: "小", size: "small" },
        { type: "text", text: "標準", size: "normal" },
        { type: "text", text: "大", size: "large" },
        { type: "text", text: "特大", size: "xlarge" },
      ],
    });
    expect(flattenSlideTextDocument(document)).toBe("小標準大特大");
    expect(() =>
      parseSlideTextDocument({
        version: 1,
        nodes: [{ type: "text", text: "A".repeat(100_001), size: "normal" }],
      }),
    ).toThrow(SlideInputError);
  });
});
