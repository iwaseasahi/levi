import { z } from "zod";

export const slideTextLimit = 200;
export const slideBodyLimit = 100_000;

export class SlideInputError extends Error {
  readonly code = "INVALID_SLIDE_INPUT";
  constructor() {
    super("INVALID_SLIDE_INPUT");
    this.name = "SlideInputError";
  }
}

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
const inputSchema = z
  .object({
    title: singleLine.refine((value) => value.length > 0),
    body: bodySchema,
  })
  .strict();

export type SlideInput = z.infer<typeof inputSchema>;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}

export function parseSlideInput(value: unknown): SlideInput {
  return parse(inputSchema, value);
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
