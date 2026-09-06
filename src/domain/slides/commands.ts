import { z } from "zod";
import type { SlideImageMetadata } from "./image";
import { parseSlideInput, parseSlideTitle, SlideInputError } from "./slide";
import type { SlideTextDocument } from "./text-document";

type SlideRecordBase = {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type TextSlideRecord = SlideRecordBase & {
  body: string;
  document?: SlideTextDocument;
  contentType?: "text";
  image?: never;
};

export type ImageSlideRecord = SlideRecordBase & {
  body: null;
  contentType: "image";
  image: Omit<SlideImageMetadata, "checksum">;
};

export type SlideRecord = TextSlideRecord | ImageSlideRecord;

export class SlideError extends Error {
  constructor(
    readonly code:
      "SLIDE_NOT_FOUND" | "SLIDE_CONFLICT" | "SLIDE_IMAGE_QUOTA_EXCEEDED",
  ) {
    super(code);
    this.name = "SlideError";
  }
}
const revision = z.number().int().min(1).max(2_147_483_647);
const deletion = z.object({ expectedRevision: revision }).strict();
const update = deletion.extend({ input: z.unknown() }).strict();
const imageTitleUpdate = z
  .object({ contentType: z.literal("image"), title: z.unknown() })
  .strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}
export const parseSlideId = (id: unknown) => parse(z.uuid(), id);
export const parseSlideRevision = (value: unknown) => parse(revision, value);
export const parseSlideDeletion = (value: unknown) => parse(deletion, value);
export function parseSlideUpdate(value: unknown) {
  const result = parse(update, value);
  const imageResult = imageTitleUpdate.safeParse(result.input);
  if (imageResult.success) {
    return {
      contentType: "image" as const,
      expectedRevision: result.expectedRevision,
      title: parseSlideTitle(imageResult.data.title),
    };
  }
  return {
    contentType: "text" as const,
    expectedRevision: result.expectedRevision,
    input: parseSlideInput(result.input),
  };
}
