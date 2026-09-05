import type { JSONContent } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import History from "@tiptap/extension-history";
import Italic from "@tiptap/extension-italic";
import ListItem from "@tiptap/extension-list-item";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { SlideInputError } from "@/domain/slides/slide";
import {
  parseSlideTextDocument,
  slideTextAlignments,
  slideTextMarks,
  slideTextPercentages,
  slideTextSizeScale,
  type SlideRichTextNode,
  type SlideTextAlignment,
  type SlideTextDocument,
  type SlideTextDocumentV2,
  type SlideTextMark,
} from "@/domain/slides/text-document";

export const slideTextSizeOptions = [
  ...slideTextPercentages.map((percent) => ({
    size: percent,
    percent,
    css: percent === 100 ? null : `${percent}%`,
  })),
];

const cssToSize = new Map(
  slideTextSizeOptions.map(({ size, css }) => [css, size]),
);
const SingleSurfaceDocument = Document.extend({
  content: "(paragraph | bulletList)+",
});

export const slideTiptapExtensions = [
  SingleSurfaceDocument,
  Paragraph,
  Text,
  HardBreak.configure({ keepMarks: true }),
  Bold,
  Italic,
  Underline,
  BulletList,
  ListItem,
  TextStyle,
  FontSize,
  TextAlign.configure({
    types: ["paragraph"],
    alignments: [...slideTextAlignments],
    defaultAlignment: "left",
  }),
  Placeholder.configure({
    placeholder: "ここにスライド本文を入力",
    showOnlyCurrent: true,
  }),
  History,
];

export const emptySlideTiptapDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { textAlign: "left" } }],
};

function invalid(): never {
  throw new SlideInputError();
}

function inlineToTiptap(node: SlideRichTextNode): JSONContent {
  if (node.type === "break") return { type: "hardBreak" };
  const marks: NonNullable<JSONContent["marks"]> = node.marks.map((type) => ({
    type,
  }));
  const percent = Math.round(slideTextSizeScale(node.size) * 100);
  const fontSize = percent === 100 ? null : `${percent}%`;
  if (fontSize) marks.push({ type: "textStyle", attrs: { fontSize } });
  return { type: "text", text: node.text, ...(marks.length ? { marks } : {}) };
}

export function slideDocumentToTiptapJson(
  document: SlideTextDocument,
): JSONContent {
  return {
    type: "doc",
    content: document.blocks.map((block) => {
      if (block.type === "bulletList") {
        return {
          type: "bulletList",
          content: block.items.map((item) => ({
            type: "listItem",
            content: [
              {
                type: "paragraph",
                attrs: { textAlign: item.alignment },
                content: item.content.map(inlineToTiptap),
              },
            ],
          })),
        };
      }
      return {
        type: "paragraph",
        attrs: { textAlign: block.alignment },
        content: block.content.map(inlineToTiptap),
      };
    }),
  };
}

function textAttributes(node: JSONContent) {
  let size = 100;
  const marks: SlideTextMark[] = [];
  const seen = new Set<string>();
  for (const mark of node.marks ?? []) {
    if (seen.has(mark.type)) invalid();
    seen.add(mark.type);
    if (slideTextMarks.includes(mark.type as SlideTextMark)) {
      if (mark.attrs || Object.keys(mark).some((key) => key !== "type"))
        invalid();
      marks.push(mark.type as SlideTextMark);
      continue;
    }
    if (
      mark.type !== "textStyle" ||
      !mark.attrs ||
      Object.keys(mark).some((key) => !["type", "attrs"].includes(key)) ||
      Object.keys(mark.attrs).some((key) => key !== "fontSize")
    ) {
      invalid();
    }
    size = cssToSize.get(mark.attrs.fontSize ?? null) ?? invalid();
  }
  return { size, marks };
}

function parseInline(content: JSONContent[] | undefined): SlideRichTextNode[] {
  return (content ?? []).map((node) => {
    if (
      node.type === "hardBreak" &&
      Object.keys(node).every((key) => ["type", "marks"].includes(key))
    ) {
      textAttributes(node);
      return { type: "break" };
    }
    if (
      node.type !== "text" ||
      typeof node.text !== "string" ||
      Object.keys(node).some((key) => !["type", "text", "marks"].includes(key))
    ) {
      invalid();
    }
    return { type: "text", text: node.text, ...textAttributes(node) };
  });
}

function alignment(node: JSONContent, extra: readonly string[] = []) {
  if (
    Object.keys(node).some(
      (key) => !["type", "attrs", "content", ...extra].includes(key),
    ) ||
    !node.attrs ||
    Object.keys(node.attrs).some(
      (key) => key !== "textAlign" && !extra.includes(key),
    )
  ) {
    invalid();
  }
  const value = node.attrs.textAlign;
  return slideTextAlignments.includes(value as SlideTextAlignment)
    ? (value as SlideTextAlignment)
    : invalid();
}

export function tiptapJsonToSlideDocument(value: JSONContent) {
  if (
    value.type !== "doc" ||
    Object.keys(value).some((key) => !["type", "content"].includes(key)) ||
    !value.content?.length
  ) {
    invalid();
  }
  const blocks: SlideTextDocumentV2["blocks"] = value.content.map((node) => {
    if (node.type === "paragraph") {
      return {
        type: "paragraph",
        alignment: alignment(node),
        content: parseInline(node.content),
      };
    }
    if (
      node.type !== "bulletList" ||
      Object.keys(node).some((key) => !["type", "content"].includes(key)) ||
      !node.content?.length
    ) {
      invalid();
    }
    return {
      type: "bulletList",
      items: node.content.map((item) => {
        if (
          item.type !== "listItem" ||
          Object.keys(item).some((key) => !["type", "content"].includes(key)) ||
          item.content?.length !== 1 ||
          item.content[0]?.type !== "paragraph"
        ) {
          invalid();
        }
        const paragraph = item.content[0];
        return {
          alignment: alignment(paragraph),
          content: parseInline(paragraph.content),
        };
      }),
    };
  });
  return parseSlideTextDocument({ version: 2, blocks });
}
