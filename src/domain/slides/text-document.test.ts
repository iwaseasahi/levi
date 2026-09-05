import { describe, expect, it } from "vitest";
import { SlideInputError } from "./boundary";
import {
  flattenSlideTextDocument,
  parseSlideTextDocument,
  slideTextDocumentFromPlainText,
  slideTextDocumentNodeLimit,
} from "./text-document";

describe("SlideTextDocument", () => {
  it("round-trips leading, trailing and repeated LF exactly", () => {
    const body = "\n一行目\n\nSecond\n";
    const document = slideTextDocumentFromPlainText(body);
    expect(flattenSlideTextDocument(document)).toBe(body);
    expect(document.blocks[0]).toMatchObject({
      type: "paragraph",
      alignment: "left",
      content: expect.arrayContaining([
        { type: "text", text: "一行目", size: 100, marks: [] },
      ]),
    });
  });

  it("normalizes adjacent runs of the same size without crossing breaks", () => {
    expect(
      parseSlideTextDocument({
        version: 2,
        blocks: [
          {
            type: "paragraph",
            alignment: "left",
            content: [
              { type: "text", text: "A", size: 130, marks: [] },
              { type: "text", text: "B", size: 130, marks: [] },
              { type: "break" },
              { type: "text", text: "C", size: 130, marks: [] },
            ],
          },
        ],
      }),
    ).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [
            { type: "text", text: "AB", size: 130, marks: [] },
            { type: "break" },
            { type: "text", text: "C", size: 130, marks: [] },
          ],
        },
      ],
    });
  });

  it.each([
    null,
    {},
    { version: 1, nodes: [] },
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

  it("allows 60–220% in 10% steps and rejects overlong text", () => {
    const document = parseSlideTextDocument({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [
            { type: "text", text: "最小", size: 60, marks: [] },
            { type: "text", text: "標準", size: 100, marks: [] },
            { type: "text", text: "最大", size: 220, marks: [] },
          ],
        },
      ],
    });
    expect(flattenSlideTextDocument(document)).toBe("最小標準最大");
    expect(() =>
      parseSlideTextDocument({
        version: 2,
        blocks: [
          {
            type: "paragraph",
            alignment: "left",
            content: [
              {
                type: "text",
                text: "A".repeat(100_001),
                size: 100,
                marks: [],
              },
            ],
          },
        ],
      }),
    ).toThrow(SlideInputError);
  });

  it("validates and normalizes the version 2 rich-text structure", () => {
    expect(
      parseSlideTextDocument({
        version: 2,
        blocks: [
          {
            type: "paragraph",
            alignment: "center",
            content: [
              {
                type: "text",
                text: "A",
                size: 130,
                marks: ["underline", "bold", "bold"],
              },
              {
                type: "text",
                text: "B",
                size: 130,
                marks: ["bold", "underline"],
              },
            ],
          },
          {
            type: "bulletList",
            items: [
              {
                alignment: "left",
                content: [
                  {
                    type: "text",
                    text: "Item",
                    size: 100,
                    marks: ["italic"],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "center",
          content: [
            {
              type: "text",
              text: "AB",
              size: 130,
              marks: ["bold", "underline"],
            },
          ],
        },
        {
          type: "bulletList",
          items: [
            {
              alignment: "left",
              content: [
                {
                  type: "text",
                  text: "Item",
                  size: 100,
                  marks: ["italic"],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.each([
    { version: 2, blocks: [] },
    {
      version: 2,
      blocks: [{ type: "heading", level: 1, alignment: "left", content: [] }],
    },
    {
      version: 2,
      blocks: [{ type: "paragraph", alignment: "justify", content: [] }],
    },
    {
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [{ type: "text", text: "A", size: 100, marks: ["link"] }],
        },
      ],
    },
    {
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [{ type: "text", text: "A", size: 65, marks: [] }],
        },
      ],
    },
  ])("rejects unsupported version 2 structure %#", (value) => {
    expect(() => parseSlideTextDocument(value)).toThrow(SlideInputError);
  });
});
