import { z } from "zod";
import type { SlideRecord } from "./commands";
import { normalizeSlideEol, SlideInputError } from "./slide";

export type SlideSummary = Omit<SlideRecord, "body">;
export type SlideSearchResult = {
  slides: SlideSummary[];
  nextCursor: string | null;
};
const querySchema = z
  .string()
  .refine((value) => value.isWellFormed() && !value.includes("\0"))
  .transform(normalizeSlideEol)
  .refine((value) => [...value].length <= 200);
const cursorSchema = z
  .object({
    version: z.literal(1),
    q: querySchema,
    createdAt: z.iso
      .datetime({ precision: 3 })
      .refine((value) => !value.startsWith("0000-")),
    id: z.uuid(),
  })
  .strict();
export type SlideCursor = z.infer<typeof cursorSchema>;
const searchSchema = z
  .object({
    mode: z.enum(["all", "recent"]).default("all"),
    q: querySchema.default(""),
    cursor: z.string().max(3000).optional(),
  })
  .strict();
export type SlideSearch = {
  mode: "all" | "recent";
  q: string;
  cursor: SlideCursor | null;
};

export function parseSlideSearch(value: unknown): SlideSearch {
  const parsed = searchSchema.safeParse(value);
  if (!parsed.success) throw new SlideInputError();
  const { mode, q, cursor: encoded } = parsed.data;
  let cursor: SlideCursor | null = null;
  if (encoded !== undefined) {
    try {
      cursor = cursorSchema.parse(JSON.parse(encoded));
    } catch {
      throw new SlideInputError();
    }
    if (cursor.q !== q) throw new SlideInputError();
  }
  if (mode === "recent" && (q !== "" || cursor)) throw new SlideInputError();
  return { mode, q, cursor };
}

export function slideSearchPattern(query: string) {
  return `%${query.replace(/[A-Z]/g, (letter) => letter.toLowerCase()).replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export function slideSearchResult(
  search: SlideSearch,
  rows: SlideSummary[],
): SlideSearchResult {
  const limit = search.mode === "recent" ? 10 : 20;
  const slides = rows.slice(0, limit);
  const last = slides.at(-1);
  return {
    slides,
    nextCursor:
      search.mode === "all" && rows.length > limit && last
        ? JSON.stringify({
            version: 1,
            q: search.q,
            createdAt: last.createdAt,
            id: last.id,
          } satisfies SlideCursor)
        : null,
  };
}
