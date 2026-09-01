import { z } from "zod";
import type { SlideRecord } from "./commands";
import { SlideInputError } from "./slide";

export type SlideSummary = Omit<SlideRecord, "body">;
export type SlideListResult = {
  slides: SlideSummary[];
  nextCursor: string | null;
};

const cursorSchema = z
  .object({
    version: z.literal(1),
    createdAt: z.iso
      .datetime({ precision: 3 })
      .refine((value) => !value.startsWith("0000-")),
    id: z.uuid(),
  })
  .strict();
export type SlideListCursor = z.infer<typeof cursorSchema>;

const querySchema = z
  .object({ cursor: z.string().max(3000).optional() })
  .strict();
export type SlideListQuery = { cursor: SlideListCursor | null };

export function parseSlideListQuery(value: unknown): SlideListQuery {
  const parsed = querySchema.safeParse(value);
  if (!parsed.success) throw new SlideInputError();
  if (parsed.data.cursor === undefined) return { cursor: null };
  try {
    return { cursor: cursorSchema.parse(JSON.parse(parsed.data.cursor)) };
  } catch {
    throw new SlideInputError();
  }
}

export function slideListResult(
  query: SlideListQuery,
  rows: SlideSummary[],
): SlideListResult {
  const slides = rows.slice(0, 20);
  const last = slides.at(-1);
  return {
    slides,
    nextCursor:
      rows.length > 20 && last
        ? JSON.stringify({
            version: 1,
            createdAt: last.createdAt,
            id: last.id,
          } satisfies SlideListCursor)
        : null,
  };
}
