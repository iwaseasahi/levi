import { z } from "zod";
import {
  parseSlideTextDocument,
  type SlideTextDocument,
} from "./text-document";
import { SlideInputError, slideTextLimit } from "./boundary";

export {
  slideTextContentLimit,
  SlideInputError,
  slideTextLimit,
} from "./boundary";

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
const verticalAlignmentSchema = z
  .enum(slideVerticalAlignments)
  .default(defaultSlideVerticalAlignment);
const documentInputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    document: z.unknown(),
    verticalAlignment: verticalAlignmentSchema,
  })
  .strict();

export type SlideInput = {
  title: string;
  document: SlideTextDocument;
  verticalAlignment: SlideVerticalAlignment;
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}

export function parseSlideInput(value: unknown): SlideInput {
  const rich = documentInputSchema.safeParse(value);
  if (!rich.success) throw new SlideInputError();
  const document = parseSlideTextDocument(rich.data.document);
  return {
    title: rich.data.title,
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
