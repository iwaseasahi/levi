import type { JSONContent } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import { SlideInputError } from "@/domain/slides/slide";
import {
  parseSlideTextDocument,
  type SlideTextDocument,
  type SlideTextNode,
  type SlideTextSize,
} from "@/domain/slides/text-document";

export const slideTextSizeOptions = [
  { size: "small", label: "小", percent: 75, css: "75%" },
  { size: "normal", label: "標準", percent: 100, css: null },
  { size: "large", label: "大", percent: 125, css: "125%" },
  { size: "xlarge", label: "特大", percent: 150, css: "150%" },
] as const satisfies ReadonlyArray<{
  size: SlideTextSize;
  label: string;
  percent: number;
  css: string | null;
}>;

const cssToSize = new Map(
  slideTextSizeOptions.map(({ size, css }) => [css, size]),
);

const SingleSurfaceDocument = Document.extend({ content: "paragraph" });
const EnterAsHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    };
  },
});

export const slideTiptapExtensions = [
  SingleSurfaceDocument,
  Paragraph,
  Text,
  EnterAsHardBreak.configure({ keepMarks: true }),
  TextStyle,
  FontSize,
  History,
];

export const emptySlideTiptapDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function invalid(): never {
  throw new SlideInputError();
}

export function slideDocumentToTiptapJson(
  document: SlideTextDocument,
): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: document.nodes.map((node) =>
          node.type === "break"
            ? { type: "hardBreak" }
            : {
                type: "text",
                text: node.text,
                ...(node.size === "normal"
                  ? {}
                  : {
                      marks: [
                        {
                          type: "textStyle",
                          attrs: {
                            fontSize: slideTextSizeOptions.find(
                              ({ size }) => size === node.size,
                            )!.css,
                          },
                        },
                      ],
                    }),
              },
        ),
      },
    ],
  };
}

function textSize(node: JSONContent): SlideTextSize {
  if (!node.marks?.length) return "normal";
  if (node.marks.length !== 1) invalid();
  const mark = node.marks[0];
  if (
    !mark ||
    mark.type !== "textStyle" ||
    !mark.attrs ||
    Object.keys(mark.attrs).some((key) => key !== "fontSize")
  ) {
    invalid();
  }
  const size = cssToSize.get(mark.attrs.fontSize ?? null);
  return size ?? invalid();
}

export function tiptapJsonToSlideDocument(value: JSONContent) {
  if (
    value.type !== "doc" ||
    Object.keys(value).some((key) => !["type", "content"].includes(key)) ||
    value.content?.length !== 1
  ) {
    invalid();
  }
  const paragraph = value.content[0];
  if (
    !paragraph ||
    paragraph.type !== "paragraph" ||
    Object.keys(paragraph).some((key) => !["type", "content"].includes(key))
  ) {
    invalid();
  }
  const nodes: SlideTextNode[] = (paragraph.content ?? []).map((node) => {
    if (
      node.type === "hardBreak" &&
      Object.keys(node).every((key) => key === "type")
    ) {
      return { type: "break" };
    }
    if (
      node.type !== "text" ||
      typeof node.text !== "string" ||
      Object.keys(node).some((key) => !["type", "text", "marks"].includes(key))
    ) {
      invalid();
    }
    return { type: "text", text: node.text, size: textSize(node) };
  });
  return parseSlideTextDocument({ version: 1, nodes });
}
