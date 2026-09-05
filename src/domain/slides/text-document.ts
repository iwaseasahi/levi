import { z } from "zod";
import { slideBodyLimit, SlideInputError } from "./boundary";

export const slideTextDocumentNodeLimit = 10_000;
export const slideTextSizes = ["small", "normal", "large", "xlarge"] as const;
export const slideTextPercentages = [
  60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210,
  220,
] as const;
const compatibleSlideTextPercentages = new Set<number>([
  ...slideTextPercentages,
  75,
  125,
]);
export const slideTextMarks = ["bold", "italic", "underline"] as const;
export const slideTextAlignments = ["left", "center", "right"] as const;

export type SlideTextSize = (typeof slideTextSizes)[number];
export type SlideTextPercentage = (typeof slideTextPercentages)[number];
export type SlideTextMark = (typeof slideTextMarks)[number];
export type SlideTextAlignment = (typeof slideTextAlignments)[number];

export function slideTextSizeScale(size: SlideTextSize | number) {
  return typeof size === "number"
    ? size / 100
    : { small: 0.75, normal: 1, large: 1.25, xlarge: 1.5 }[size];
}

const textValueSchema = z
  .string()
  .min(1)
  .refine((value) => value.isWellFormed() && !value.includes("\0"))
  .refine((value) => !value.includes("\r") && !value.includes("\n"));

const v1TextNodeSchema = z
  .object({
    type: z.literal("text"),
    text: textValueSchema,
    size: z.enum(slideTextSizes),
  })
  .strict();
const breakNodeSchema = z.object({ type: z.literal("break") }).strict();
const v1DocumentSchema = z
  .object({
    version: z.literal(1),
    nodes: z
      .array(z.discriminatedUnion("type", [v1TextNodeSchema, breakNodeSchema]))
      .max(slideTextDocumentNodeLimit),
  })
  .strict();

const v2TextNodeSchema = z
  .object({
    type: z.literal("text"),
    text: textValueSchema,
    size: z
      .number()
      .int()
      .refine((value) => compatibleSlideTextPercentages.has(value)),
    marks: z.array(z.enum(slideTextMarks)).max(slideTextMarks.length),
  })
  .strict();
const inlineNodeSchema = z.discriminatedUnion("type", [
  v2TextNodeSchema,
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
const v2DocumentSchema = z
  .object({
    version: z.literal(2),
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
const documentSchema = z.discriminatedUnion("version", [
  v1DocumentSchema,
  v2DocumentSchema,
]);

export type SlideTextDocumentV1 = z.infer<typeof v1DocumentSchema>;
export type SlideTextDocumentV2 = z.infer<typeof v2DocumentSchema>;
export type SlideTextDocument = z.infer<typeof documentSchema>;
export type SlideTextNode = SlideTextDocumentV1["nodes"][number];
export type SlideRichTextNode = z.infer<typeof inlineNodeSchema>;
export type SlideTextBlock = SlideTextDocumentV2["blocks"][number];

function invalid(): never {
  throw new SlideInputError();
}

function flattenInline(nodes: readonly SlideRichTextNode[]) {
  return nodes
    .map((node) => (node.type === "break" ? "\n" : node.text))
    .join("");
}

export function flattenSlideTextDocument(document: SlideTextDocument) {
  if (document.version === 1) {
    return document.nodes
      .map((node) => (node.type === "break" ? "\n" : node.text))
      .join("");
  }
  return document.blocks
    .flatMap((block) =>
      block.type === "bulletList"
        ? block.items.map((item) => flattenInline(item.content))
        : [flattenInline(block.content)],
    )
    .join("\n");
}

function normalizeV1(document: SlideTextDocumentV1): SlideTextDocumentV1 {
  const nodes: SlideTextNode[] = [];
  for (const node of document.nodes) {
    const previous = nodes.at(-1);
    if (
      node.type === "text" &&
      previous?.type === "text" &&
      previous.size === node.size
    ) {
      previous.text += node.text;
    } else {
      nodes.push({ ...node });
    }
  }
  return { version: 1, nodes };
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

function normalizeV2(document: SlideTextDocumentV2): SlideTextDocumentV2 {
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
  return { version: 2, blocks };
}

export function normalizeSlideTextDocument(
  document: SlideTextDocument,
): SlideTextDocument {
  const normalized =
    document.version === 1 ? normalizeV1(document) : normalizeV2(document);
  const body = flattenSlideTextDocument(normalized);
  if (
    body.replace(/^[ \t\n]+|[ \t\n]+$/g, "").length === 0 ||
    [...body].length > slideBodyLimit
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

export function slideTextDocumentFromPlainText(body: string) {
  const nodes: SlideTextNode[] = [];
  for (const [index, part] of body.split("\n").entries()) {
    if (index > 0) nodes.push({ type: "break" });
    if (part) nodes.push({ type: "text", text: part, size: "normal" });
  }
  const document = parseSlideTextDocument({ version: 1, nodes });
  if (document.version !== 1) invalid();
  return document;
}

export function slideTextDocument(
  document: SlideTextDocument | undefined,
  body: string,
) {
  return document
    ? parseSlideTextDocument(document)
    : slideTextDocumentFromPlainText(body);
}
