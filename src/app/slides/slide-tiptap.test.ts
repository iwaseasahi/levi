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
      version: 1,
      nodes: [
        { type: "text", text: "A", size: "normal" },
        { type: "text", text: "BC", size: "xlarge" },
        { type: "text", text: "D", size: "normal" },
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
    ).toEqual(document);
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
