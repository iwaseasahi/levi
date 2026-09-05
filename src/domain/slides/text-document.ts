import { z } from "zod";
import { slideBodyLimit, SlideInputError } from "./boundary";

export const slideTextDocumentNodeLimit = 10_000;
export const slideTextSizes = ["small", "normal", "large", "xlarge"] as const;
export type SlideTextSize = (typeof slideTextSizes)[number];

export function slideTextSizeScale(size: SlideTextSize) {
  return { small: 0.75, normal: 1, large: 1.25, xlarge: 1.5 }[size];
}

const textNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z
      .string()
      .min(1)
      .refine((value) => value.isWellFormed() && !value.includes("\0"))
      .refine((value) => !value.includes("\r") && !value.includes("\n")),
    size: z.enum(slideTextSizes),
  })
  .strict();

const breakNodeSchema = z.object({ type: z.literal("break") }).strict();

const documentSchema = z
  .object({
    version: z.literal(1),
    nodes: z
      .array(z.discriminatedUnion("type", [textNodeSchema, breakNodeSchema]))
      .max(slideTextDocumentNodeLimit),
  })
  .strict();

export type SlideTextNode = z.infer<typeof documentSchema>["nodes"][number];
export type SlideTextDocument = z.infer<typeof documentSchema>;

function invalid(): never {
  throw new SlideInputError();
}

export function flattenSlideTextDocument(document: SlideTextDocument) {
  return document.nodes
    .map((node) => (node.type === "break" ? "\n" : node.text))
    .join("");
}

export function normalizeSlideTextDocument(
  document: SlideTextDocument,
): SlideTextDocument {
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
  const normalized = { version: 1 as const, nodes };
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
  return parseSlideTextDocument({ version: 1, nodes });
}

export function slideTextDocument(
  document: SlideTextDocument | undefined,
  body: string,
) {
  return document
    ? parseSlideTextDocument(document)
    : slideTextDocumentFromPlainText(body);
}
