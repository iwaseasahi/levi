import { z } from "zod";
import { slideTextContentLimit, SlideInputError } from "./boundary";

export const slideTextDocumentNodeLimit = 10_000;
export const slideTextDocumentVersion = 2;
export const slideTextPercentages = [
  50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
] as const;
const allowedSlideTextPercentages = new Set<number>(slideTextPercentages);
export const slideTextMarks = ["bold", "italic", "underline"] as const;
export const slideTextAlignments = ["left", "center", "right"] as const;

export type SlideTextPercentage = (typeof slideTextPercentages)[number];
export type SlideTextMark = (typeof slideTextMarks)[number];
export type SlideTextAlignment = (typeof slideTextAlignments)[number];

const slideTextPercentageSchema = z
  .number()
  .int()
  .refine((value) => allowedSlideTextPercentages.has(value))
  .transform((value) => value as SlideTextPercentage);

export function slideTextSizeScale(size: number) {
  return size / 100;
}

const textValueSchema = z
  .string()
  .min(1)
  .refine((value) => value.isWellFormed() && !value.includes("\0"))
  .refine((value) => !value.includes("\r") && !value.includes("\n"));

const breakNodeSchema = z.object({ type: z.literal("break") }).strict();

const textNodeSchema = z
  .object({
    type: z.literal("text"),
    text: textValueSchema,
    size: slideTextPercentageSchema,
    marks: z.array(z.enum(slideTextMarks)).max(slideTextMarks.length),
  })
  .strict();
const inlineNodeSchema = z.discriminatedUnion("type", [
  textNodeSchema,
  breakNodeSchema,
]);
const inlineContentSchema = z
  .array(inlineNodeSchema)
  .max(slideTextDocumentNodeLimit);
const paragraphBlockSchema = z
  .object({
    type: z.literal("paragraph"),
    alignment: z.enum(slideTextAlignments),
    content: inlineContentSchema,
  })
  .strict();
const listItemSchema = z
  .object({
    alignment: z.enum(slideTextAlignments),
    content: inlineContentSchema,
  })
  .strict();
const bulletListBlockSchema = z
  .object({
    type: z.literal("bulletList"),
    items: z.array(listItemSchema).min(1).max(slideTextDocumentNodeLimit),
  })
  .strict();
const documentSchema = z
  .object({
    version: z.literal(slideTextDocumentVersion),
    blocks: z
      .array(
        z.discriminatedUnion("type", [
          paragraphBlockSchema,
          bulletListBlockSchema,
        ]),
      )
      .min(1)
      .max(slideTextDocumentNodeLimit),
  })
  .strict();
export type SlideTextDocument = z.infer<typeof documentSchema>;
export type SlideRichTextNode = z.infer<typeof inlineNodeSchema>;
export type SlideTextBlock = SlideTextDocument["blocks"][number];

function invalid(): never {
  throw new SlideInputError();
}

function flattenInline(nodes: readonly SlideRichTextNode[]) {
  return nodes
    .map((node) => (node.type === "break" ? "\n" : node.text))
    .join("");
}

export function flattenSlideTextDocument(document: SlideTextDocument) {
  return document.blocks
    .flatMap((block) =>
      block.type === "bulletList"
        ? block.items.map((item) => flattenInline(item.content))
        : [flattenInline(block.content)],
    )
    .join("\n");
}

function normalizeInline(nodes: readonly SlideRichTextNode[]) {
  const normalized: SlideRichTextNode[] = [];
  for (const node of nodes) {
    if (node.type === "break") {
      normalized.push({ type: "break" });
      continue;
    }
    const marks = [...new Set(node.marks)].sort() as SlideTextMark[];
    const previous = normalized.at(-1);
    if (
      previous?.type === "text" &&
      previous.size === node.size &&
      previous.marks.join() === marks.join()
    ) {
      previous.text += node.text;
    } else {
      normalized.push({ ...node, marks });
    }
  }
  return normalized;
}

function normalizeDocument(document: SlideTextDocument): SlideTextDocument {
  const blocks = document.blocks.map((block) =>
    block.type === "bulletList"
      ? {
          type: "bulletList" as const,
          items: block.items.map((item) => ({
            ...item,
            content: normalizeInline(item.content),
          })),
        }
      : { ...block, content: normalizeInline(block.content) },
  );
  const nodeCount = blocks.reduce(
    (total, block) =>
      total +
      1 +
      (block.type === "bulletList"
        ? block.items.reduce((sum, item) => sum + 1 + item.content.length, 0)
        : block.content.length),
    0,
  );
  if (nodeCount > slideTextDocumentNodeLimit) invalid();
  return { version: slideTextDocumentVersion, blocks };
}

export function normalizeSlideTextDocument(
  document: SlideTextDocument,
): SlideTextDocument {
  const normalized = normalizeDocument(document);
  const text = flattenSlideTextDocument(normalized);
  if (
    text.replace(/^[ \t\n]+|[ \t\n]+$/g, "").length === 0 ||
    [...text].length > slideTextContentLimit
  ) {
    invalid();
  }
  return normalized;
}

export function parseSlideTextDocument(value: unknown): SlideTextDocument {
  const result = documentSchema.safeParse(value);
  if (!result.success) invalid();
  return normalizeSlideTextDocument(result.data);
}

export function slideTextDocumentFromPlainText(text: string) {
  const content: SlideRichTextNode[] = [];
  for (const [index, part] of text.split("\n").entries()) {
    if (index > 0) content.push({ type: "break" });
    if (part) content.push({ type: "text", text: part, size: 100, marks: [] });
  }
  return parseSlideTextDocument({
    version: slideTextDocumentVersion,
    blocks: [{ type: "paragraph", alignment: "left", content }],
  });
}
