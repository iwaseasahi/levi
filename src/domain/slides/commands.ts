import { z } from "zod";
import { parseSlideInput, SlideInputError, type SlideInput } from "./slide";

export type SlideRecord = SlideInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export class SlideError extends Error {
  constructor(readonly code: "SLIDE_NOT_FOUND" | "SLIDE_CONFLICT") {
    super(code);
    this.name = "SlideError";
  }
}
const revision = z.number().int().min(1).max(2_147_483_647);
const deletion = z.object({ expectedRevision: revision }).strict();
const update = deletion.extend({ input: z.unknown() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new SlideInputError();
  return result.data;
}
export const parseSlideId = (id: unknown) => parse(z.uuid(), id);
export const parseSlideDeletion = (value: unknown) => parse(deletion, value);
export function parseSlideUpdate(value: unknown) {
  const result = parse(update, value);
  return {
    expectedRevision: result.expectedRevision,
    input: parseSlideInput(result.input),
  };
}
