import { z } from "zod";
import {
  flattenSlideTextDocument,
  parseSlideTextDocument,
  slideTextDocumentFromPlainText,
  type SlideTextDocument,
} from "./text-document";
import { slideBodyLimit, SlideInputError, slideTextLimit } from "./boundary";

export { slideBodyLimit, SlideInputError, slideTextLimit } from "./boundary";

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
const plainInputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    body: bodySchema,
  })
  .strict();

const documentInputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    document: z.unknown(),
  })
  .strict();

export type SlideInput = {
  title: string;
  body: string;
  document?: SlideTextDocument;
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
  };
}

export function parseSlideTitle(value: unknown): string {
  return parse(
    singleLine.refine((title) => title.length > 0),
    value,
  );
}

// Preview validates only body; a missing title must not prevent preview.
export function parseSlideBody(value: unknown): string {
  return parse(bodySchema, value);
}
