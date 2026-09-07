import { z } from "zod";
import {
  flattenSlideTextDocument,
  parseSlideTextDocument,
  slideTextDocumentFromPlainText,
  type SlideTextDocument,
} from "./text-document";
import { slideBodyLimit, SlideInputError, slideTextLimit } from "./boundary";

export { slideBodyLimit, SlideInputError, slideTextLimit } from "./boundary";

export const slideVerticalAlignments = ["top", "center", "bottom"] as const;
export type SlideVerticalAlignment = (typeof slideVerticalAlignments)[number];
export const defaultSlideVerticalAlignment: SlideVerticalAlignment = "center";

export function normalizeSlideEol(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function trimAscii(value: string) {
  return value.replace(/^[ \t\n]+|[ \t\n]+$/g, "");
}

const normalizedText = z
  .string()
  .refine((value) => value.isWellFormed() && !value.includes("\0"))
  .transform(normalizeSlideEol);
const singleLine = normalizedText
  .transform(trimAscii)
  .refine(
    (value) => !/[\t\n]/.test(value) && [...value].length <= slideTextLimit,
  );
const bodySchema = normalizedText.refine(
  (value) => trimAscii(value).length > 0 && [...value].length <= slideBodyLimit,
);
const verticalAlignmentSchema = z
  .enum(slideVerticalAlignments)
  .default(defaultSlideVerticalAlignment);
const plainInputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    body: bodySchema,
    verticalAlignment: verticalAlignmentSchema,
  })
  .strict();

const documentInputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    document: z.unknown(),
    verticalAlignment: verticalAlignmentSchema,
  })
  .strict();

export type SlideInput = {
  title: string;
  body: string;
  document?: SlideTextDocument;
  verticalAlignment: SlideVerticalAlignment;
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}

export function parseSlideInput(value: unknown): SlideInput {
  const plain = plainInputSchema.safeParse(value);
  if (plain.success) {
    return {
      ...plain.data,
      document: slideTextDocumentFromPlainText(plain.data.body),
    };
  }
  const rich = documentInputSchema.safeParse(value);
  if (!rich.success) throw new SlideInputError();
  const document = parseSlideTextDocument(rich.data.document);
  return {
    title: rich.data.title,
    body: parseSlideBody(flattenSlideTextDocument(document)),
    document,
    verticalAlignment: rich.data.verticalAlignment,
  };
}

export function parseSlideTitle(value: unknown): string {
  return parse(
    singleLine.refine((title) => title.length > 0),
    value,
  );
}

export function parseSlideVerticalAlignment(
  value: unknown,
): SlideVerticalAlignment {
  return parse(z.enum(slideVerticalAlignments), value);
}

// Preview validates only body; a missing title must not prevent preview.
export function parseSlideBody(value: unknown): string {
  return parse(bodySchema, value);
}
