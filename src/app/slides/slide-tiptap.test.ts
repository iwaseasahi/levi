import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { SlideInputError } from "@/domain/slides/slide";
import { parseSlideTextDocument } from "@/domain/slides/text-document";
import {
  slideDocumentToTiptapJson,
  slideTiptapExtensions,
  tiptapJsonToSlideDocument,
} from "./slide-tiptap";

describe("Slide Tiptap adapter", () => {
  it("changes only the selected text range", () => {
    const editor = new Editor({
      extensions: slideTiptapExtensions,
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "ABCD" }] },
        ],
      },
    });
    editor
      .chain()
      .setTextSelection({ from: 2, to: 4 })
      .setFontSize("150%")
      .run();
    expect(tiptapJsonToSlideDocument(editor.getJSON())).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [
            { type: "text", text: "A", size: 100, marks: [] },
            { type: "text", text: "BC", size: 150, marks: [] },
            { type: "text", text: "D", size: 100, marks: [] },
          ],
        },
      ],
    });
    editor.destroy();
  });
  it("round-trips application-owned runs and exact hard breaks", () => {
    const document = parseSlideTextDocument({
      version: 1,
      nodes: [
        { type: "break" },
        { type: "text", text: "Small", size: "small" },
        { type: "break" },
        { type: "break" },
        { type: "text", text: "Large", size: "large" },
        { type: "break" },
      ],
    });
    expect(
      tiptapJsonToSlideDocument(slideDocumentToTiptapJson(document)),
    ).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "left",
          content: [
            { type: "break" },
            { type: "text", text: "Small", size: 75, marks: [] },
            { type: "break" },
            { type: "break" },
            { type: "text", text: "Large", size: 125, marks: [] },
            { type: "break" },
          ],
        },
      ],
    });
  });

  it("round-trips rich marks, alignment and bullet lists", () => {
    const document = parseSlideTextDocument({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "center",
          content: [
            {
              type: "text",
              text: "Lead",
              size: 130,
              marks: ["bold", "italic", "underline"],
            },
          ],
        },
        {
          type: "bulletList",
          items: [
            {
              alignment: "left",
              content: [{ type: "text", text: "First", size: 100, marks: [] }],
            },
            {
              alignment: "right",
              content: [
                {
                  type: "text",
                  text: "Second",
                  size: 80,
                  marks: ["bold"],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(
      tiptapJsonToSlideDocument(slideDocumentToTiptapJson(document)),
    ).toEqual(document);
  });

  it("applies every supported rich-text command through Tiptap", () => {
    const editor = new Editor({
      extensions: slideTiptapExtensions,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "A" },
              { type: "hardBreak" },
              { type: "text", text: "A2" },
            ],
          },
          { type: "paragraph", content: [{ type: "text", text: "B" }] },
        ],
      },
    });
    expect(
      editor
        .chain()
        .setTextSelection({ from: 1, to: 5 })
        .toggleBold()
        .toggleItalic()
        .toggleUnderline()
        .setFontSize("120%")
        .setTextAlign("center")
        .run(),
    ).toBe(true);
    expect(
      editor
        .chain()
        .setTextSelection({ from: 7, to: 8 })
        .toggleBulletList()
        .run(),
    ).toBe(true);
    expect(tiptapJsonToSlideDocument(editor.getJSON())).toEqual({
      version: 2,
      blocks: [
        {
          type: "paragraph",
          alignment: "center",
          content: [
            {
              type: "text",
              text: "A",
              size: 120,
              marks: ["bold", "italic", "underline"],
            },
            { type: "break" },
            {
              type: "text",
              text: "A2",
              size: 120,
              marks: ["bold", "italic", "underline"],
            },
          ],
        },
        {
          type: "bulletList",
          items: [
            {
              alignment: "left",
              content: [{ type: "text", text: "B", size: 100, marks: [] }],
            },
          ],
        },
      ],
    });
    editor.destroy();
  });

  it.each([
    { type: "doc", content: [] },
    { type: "doc", content: [{ type: "paragraph" }], extra: true },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "A", marks: [{ type: "bold" }] }],
        },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A",
              marks: [{ type: "textStyle", attrs: { fontSize: "999px" } }],
            },
          ],
        },
      ],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "https://invalid" } }],
        },
      ],
    },
  ])("rejects unsupported Tiptap nodes, marks and attributes", (value) => {
    expect(() => tiptapJsonToSlideDocument(value)).toThrow(SlideInputError);
  });
});
